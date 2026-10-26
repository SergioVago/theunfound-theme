/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionCommon, Services, Cu, Ci */

"use strict";

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

const AUTHOR_SHEET = Ci.nsIDOMWindowUtils.AUTHOR_SHEET;
const DOCUMENT_TOPIC = "document-element-inserted";
// Avisado por cada instância ao iniciar: uma instância anterior que ainda
// esteja rodando (upgrade intercalado, "Desfazer" do about:addons depois de
// instalar por cima...) se recolhe sozinha.
const INSTANCE_TOPIC = "theunfound-theme:instance-started";

/*
 * Tudo que fica nas janelas pertence a UMA instância (id único por início):
 *  - host resource://theunfound-theme-<id>/ (scripts com privilégio de
 *    sistema não carregam de moz-extension:);
 *  - atributos de raiz unf-* — unf-ui guarda o id do dono, e só o dono os
 *    remove;
 *  - o decorador da janela (window.UnfoundSkinDecorator.instance).
 * Cada instância só desfaz o que é dela: assim um desligamento atrasado (uma
 * instalação por cima, o "Desfazer" do about:addons) não apaga o visual da
 * instância que acabou de assumir.
 */
const ROOT_ATTRIBUTE = "unf-ui";
const OPTION_ATTRIBUTES = [
  "unf-avatars",
  "unf-previews",
  "unf-proportional",
  "unf-sender",
];
const DECORATOR_GLOBAL = "UnfoundSkinDecorator";

function resourceHandler() {
  return Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
}

const DEFAULT_OPTIONS = Object.freeze({
  theme: "auto",
  avatars: true,
  previews: true,
  // "smart" (nome inteligente) | "full" (nome e endereço) | "name" (só o nome)
  senderDisplay: "smart",
  proportionalPlainText: true,
  // Barra de áreas + painel de pastas em grafite, independentes do tema claro/escuro.
  darkSidebar: true,
  // Foto escolhida nas opções para cada conta: { [account.key]: dataURL }.
  accountPhotos: Object.freeze({}),
});

// Módulo compartilhado pelas janelas com as regras de remetente.
const TRUST_MODULE = "content/SenderTrust.sys.mjs";

// Documents that receive the theme's skin. In Thunderbird 115+ each pane lives in
// its own document, so each one needs its own sheet (and sometimes a script).
const DOCUMENTS = {
  "chrome://messenger/content/messenger.xhtml": {
    sheets: ["skin/messenger.css", "skin/sidebar.css"],
    // Barra escura e trilho de contas de todas as abas de e-mail da janela.
    script: "content/sidebarDecorator.js",
  },
  "chrome://messenger/content/messageWindow.xhtml": {
    sheets: ["skin/messenger.css"],
  },
  "chrome://messenger/content/messengercompose/messengercompose.xhtml": {
    sheets: ["skin/compose.css"],
  },
  "about:3pane": {
    sheets: ["skin/about3pane.css", "skin/sidebar.css"],
    script: "content/threadDecorator.js",
  },
  "about:message": {
    sheets: ["skin/aboutMessage.css"],
    script: "content/messageDecorator.js",
  },
};

// The message body itself (mailbox:, imap:, news: ... documents shown in the
// <browser id="messagepane"> of about:message). Only spacing and, optionally,
// the plain text font are touched; HTML e-mails keep their own styles.
const MESSAGE_CONTENT = {
  sheets: ["skin/messageContent.css"],
};

function specFor(doc) {
  const spec = DOCUMENTS[doc.documentURI];
  if (spec) {
    return spec;
  }
  if (doc.documentURI == "about:blank") {
    return null;
  }
  try {
    const embedder = doc.defaultView?.browsingContext?.embedderElement;
    if (
      embedder?.id == "messagepane" &&
      embedder.ownerDocument?.documentURI == "about:message"
    ) {
      return MESSAGE_CONTENT;
    }
  } catch (e) {}
  return null;
}

function isAlive(obj) {
  return obj && !Cu.isDeadWrapper(obj);
}

/** Desinstala e apaga o decorador desta instância na janela. */
function removeDecorator(win, name) {
  try {
    win[name]?.uninstall?.();
  } catch (e) {
    console.error(e);
  }
  try {
    delete win[name];
  } catch (e) {}
}

function isTopLevelChromeWindow(win) {
  try {
    return (
      win.top === win &&
      win.docShell?.itemType == Ci.nsIDocShellTreeItem.typeChrome
    );
  } catch (e) {
    return false;
  }
}

class UnfoundInjector {
  constructor(extension) {
    this.extension = extension;
    // Único por início: separa o estado desta instância do de qualquer outra
    // (e, por estar nas URLs, impede o reaproveitamento de folhas e scripts
    // em cache depois de uma atualização).
    const random = Math.floor(Math.random() * 36 ** 4).toString(36);
    this.id = `${extension.version.replace(/[^0-9a-z]/gi, "")}-${Date.now().toString(36)}${random}`;
    this.host = `theunfound-theme-${this.id}`.toLowerCase();
    this.options = { ...DEFAULT_OPTIONS };
    this.documents = new Set();
    this.styledDocuments = new WeakSet();
    this.specs = new WeakMap();
    this.colorWindows = new Map();
    this.running = false;
    this.superseded = false;
  }

  url(path) {
    return `resource://${this.host}/${path}`;
  }

  start() {
    if (this.running || this.superseded) {
      return;
    }
    this.running = true;
    // Primeiro as instâncias anteriores se recolhem; depois esta assume.
    this.stopOtherInstances();
    Services.obs.notifyObservers(null, INSTANCE_TOPIC, this.id);
    Services.obs.addObserver(this, INSTANCE_TOPIC);
    resourceHandler().setSubstitution(this.host, this.extension.rootURI);
    Services.obs.addObserver(this, DOCUMENT_TOPIC);
    for (const win of Services.wm.getEnumerator(null)) {
      this.applyToWindowTree(win);
    }
  }

  /**
   * Desliga qualquer outra instância deste addon que ainda observe documentos.
   * Acontece quando o Thunderbird deixa uma instância órfã (ex.: "Desfazer" no
   * about:addons depois de instalar por cima) ou desliga a antiga depois de
   * iniciar a nova. O stop() dela só mexe no que é dela, e um onShutdown
   * atrasado vira no-op, porque ela já não está "running".
   */
  stopOtherInstances() {
    const others = [];
    for (const observer of Services.obs.enumerateObservers(DOCUMENT_TOPIC)) {
      try {
        const other = observer.wrappedJSObject ?? observer;
        if (
          other !== this &&
          !Cu.isDeadWrapper(other) &&
          other.extension?.id == this.extension.id &&
          typeof other.stop == "function"
        ) {
          others.push(other);
        }
      } catch (e) {}
    }
    for (const other of others) {
      try {
        other.superseded = true;
        other.stop();
        // Que o background dela não a religue depois.
        other.start = () => {};
      } catch (e) {
        console.error("theUnfound Theme: falha ao desligar instância anterior", e);
      }
    }
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    Services.obs.removeObserver(this, DOCUMENT_TOPIC);
    Services.obs.removeObserver(this, INSTANCE_TOPIC);

    for (const doc of this.liveDocuments()) {
      this.unstyleDocument(doc);
    }
    this.documents.clear();

    // Só desfaz o tema forçado onde o valor ainda é o que esta instância pôs,
    // e não quando outra instância já assumiu (ela cuida das janelas).
    if (!this.superseded) {
      for (const [ref, value] of this.colorWindows) {
        const win = ref.deref();
        if (isAlive(win) && !win.closed) {
          try {
            if (win.browsingContext.prefersColorSchemeOverride == value) {
              win.browsingContext.prefersColorSchemeOverride = "none";
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
    this.colorWindows.clear();

    // O módulo continua carregado (ESMs não descarregam): solta caches e
    // observadores dele.
    try {
      const url = this.url(TRUST_MODULE);
      if (Cu.isESModuleLoaded(url)) {
        ChromeUtils.importESModule(url).reset();
      }
    } catch (e) {
      console.error(e);
    }
    resourceHandler().setSubstitution(this.host, null);
  }

  configure(options = {}) {
    const clean = {};
    for (const key of Object.keys(DEFAULT_OPTIONS)) {
      if (options[key] !== undefined && options[key] !== null) {
        clean[key] = options[key];
      }
    }
    this.options = { ...DEFAULT_OPTIONS, ...clean };

    for (const doc of this.liveDocuments()) {
      this.applyRootAttributes(doc);
      this.configureDecorator(doc);
    }
    for (const win of Services.wm.getEnumerator(null)) {
      this.applyColorScheme(win);
    }
  }

  // nsIObserver
  observe(subject, topic, data) {
    if (topic == INSTANCE_TOPIC) {
      if (data != this.id) {
        this.superseded = true;
        this.stop();
      }
      return;
    }
    if (topic != DOCUMENT_TOPIC || !subject) {
      return;
    }
    const doc = subject;
    const win = doc.defaultView;
    if (!win) {
      return;
    }
    if (isTopLevelChromeWindow(win)) {
      this.applyColorScheme(win);
    }
    if (specFor(doc)) {
      this.styleDocument(doc);
    }
  }

  *liveDocuments() {
    for (const ref of this.documents) {
      const doc = ref.deref();
      if (!isAlive(doc) || !doc.defaultView) {
        this.documents.delete(ref);
        continue;
      }
      yield doc;
    }
  }

  applyToWindowTree(win) {
    if (isTopLevelChromeWindow(win)) {
      this.applyColorScheme(win);
    }
    let contexts = [];
    try {
      contexts = win.browsingContext.getAllBrowsingContextsInSubtree();
    } catch (e) {
      return;
    }
    for (const bc of contexts) {
      let doc = null;
      try {
        doc = bc.docShell?.domWindow?.document;
      } catch (e) {
        continue;
      }
      if (doc && specFor(doc)) {
        this.styleDocument(doc);
      }
    }
  }

  applyColorScheme(win) {
    if (!isTopLevelChromeWindow(win)) {
      return;
    }
    const value = this.options.theme == "auto" ? "none" : this.options.theme;
    try {
      const bc = win.browsingContext;
      if (bc.prefersColorSchemeOverride != value) {
        bc.prefersColorSchemeOverride = value;
      }
      if (value != "none") {
        for (const ref of this.colorWindows.keys()) {
          if (ref.deref() === win) {
            this.colorWindows.set(ref, value);
            return;
          }
        }
        this.colorWindows.set(new WeakRef(win), value);
      }
    } catch (e) {
      console.error(e);
    }
  }

  applyRootAttributes(doc) {
    const root = doc.documentElement;
    if (!root) {
      return;
    }
    root.setAttribute(ROOT_ATTRIBUTE, this.id);
    root.toggleAttribute("unf-avatars", !!this.options.avatars);
    root.toggleAttribute("unf-previews", !!this.options.previews);
    root.toggleAttribute(
      "unf-proportional",
      !!this.options.proportionalPlainText
    );
    root.setAttribute("unf-sender", this.options.senderDisplay);
  }

  styleDocument(doc) {
    if (this.styledDocuments.has(doc)) {
      return;
    }
    const spec = specFor(doc);
    const win = doc.defaultView;
    this.styledDocuments.add(doc);
    this.specs.set(doc, spec);
    this.documents.add(new WeakRef(doc));

    for (const sheet of spec.sheets) {
      try {
        win.windowUtils.loadSheetUsingURIString(this.url(sheet), AUTHOR_SHEET);
      } catch (e) {
        console.error(`theUnfound Theme: falha ao carregar ${sheet}`, e);
      }
    }
    this.applyRootAttributes(doc);

    // The message body browser is a separate (content) tree, so it is not
    // reached by getAllBrowsingContextsInSubtree(); pick it up from here.
    if (doc.documentURI == "about:message") {
      try {
        const body = doc.getElementById("messagepane")?.contentDocument;
        if (body && specFor(body)) {
          this.styleDocument(body);
        }
      } catch (e) {}
    }

    if (spec.script) {
      const load = () => {
        if (this.running && isAlive(doc) && doc.defaultView) {
          this.loadDecorator(doc, spec.script);
        }
      };
      if (doc.readyState == "complete") {
        load();
      } else {
        win.addEventListener("load", load, { once: true });
      }
    }
  }

  unstyleDocument(doc) {
    const win = doc.defaultView;
    const decorator = win[DECORATOR_GLOBAL];
    if (decorator?.instance == this.id) {
      removeDecorator(win, DECORATOR_GLOBAL);
    }

    const spec = this.specs.get(doc);
    for (const sheet of spec?.sheets ?? []) {
      try {
        win.windowUtils.removeSheetUsingURIString(this.url(sheet), AUTHOR_SHEET);
      } catch (e) {}
    }
    const root = doc.documentElement;
    if (root?.getAttribute(ROOT_ATTRIBUTE) == this.id) {
      root.removeAttribute(ROOT_ATTRIBUTE);
      for (const name of OPTION_ATTRIBUTES) {
        root.removeAttribute(name);
      }
    }
    this.styledDocuments.delete(doc);
  }

  loadDecorator(doc, script) {
    const win = doc.defaultView;
    const current = win[DECORATOR_GLOBAL];
    if (current) {
      if (current.instance == this.id && current.isActive?.()) {
        this.configureDecorator(doc);
        return;
      }
      removeDecorator(win, DECORATOR_GLOBAL);
    }
    try {
      // The script runs inside the target window (its own compartment), so
      // nothing in that window keeps references into this extension.
      Services.scriptloader.loadSubScriptWithOptions(this.url(script), {
        target: win,
        ignoreCache: true,
      });
      const decorator = win[DECORATOR_GLOBAL];
      if (decorator) {
        decorator.instance = this.id;
        decorator.version = this.extension.version;
      }
      this.configureDecorator(doc);
    } catch (e) {
      console.error(`theUnfound Theme: falha ao carregar ${script}`, e);
    }
  }

  configureDecorator(doc) {
    try {
      const decorator = doc.defaultView?.[DECORATOR_GLOBAL];
      if (decorator?.instance != this.id) {
        return;
      }
      decorator.configure(
        Cu.cloneInto(
          { ...this.options, trustModuleURL: this.url(TRUST_MODULE) },
          doc.defaultView
        )
      );
    } catch (e) {
      console.error(e);
    }
  }
}

const PHOTO_TYPES = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp", gif: "gif" };

/**
 * Contas mostradas no trilho (mesmo critério de content/sidebarDecorator.js:
 * com identidade e Caixa de entrada), para a seção "Contas" das opções. A
 * foto do catálogo vai como data: — a página de opções não lê file://.
 */
async function listMailAccounts() {
  const { MailServices } = ChromeUtils.importESModule(
    "resource:///modules/MailServices.sys.mjs"
  );
  const accounts = [];
  for (const account of MailServices.accounts.accounts) {
    try {
      const server = account.incomingServer;
      const identity = account.defaultIdentity;
      if (!server || !identity || server.type == "none") {
        continue;
      }
      if (!server.rootMsgFolder?.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)) {
        continue;
      }
      const email = identity.email || "";
      let addressBookPhoto = "";
      try {
        addressBookPhoto =
          (email && MailServices.ab.cardForEmailAddress(email)?.photoURL) || "";
        if (addressBookPhoto.startsWith("file:")) {
          const file = Services.io
            .newURI(addressBookPhoto)
            .QueryInterface(Ci.nsIFileURL).file;
          const bytes = await IOUtils.read(file.path, { maxBytes: 4 << 20 });
          const base64 = ChromeUtils.base64URLEncode(bytes, { pad: true })
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const ext = file.leafName.split(".").pop().toLowerCase();
          addressBookPhoto = `data:image/${PHOTO_TYPES[ext] ?? "jpeg"};base64,${base64}`;
        }
      } catch (e) {
        addressBookPhoto = "";
      }
      accounts.push({
        key: account.key,
        name: server.prettyName || email,
        email,
        fullName: identity.fullName || "",
        addressBookPhoto,
      });
    } catch (e) {
      // Conta quebrada ou ainda carregando.
    }
  }
  return accounts;
}

this.unfoundTheme = class extends ExtensionCommon.ExtensionAPI {
  get injector() {
    if (!this._injector) {
      this._injector = new UnfoundInjector(this.extension);
    }
    return this._injector;
  }

  onStartup() {
    this.injector.start();
  }

  onShutdown(isAppShutdown) {
    this._isShutDown = true;
    if (isAppShutdown) {
      return;
    }
    this._injector?.stop();
    this._injector = null;
    // Make sure an updated version does not run cached copies of our scripts.
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  getAPI() {
    const api = this;
    return {
      unfoundTheme: {
        async configure(options) {
          if (api._isShutDown) {
            return;
          }
          api.injector.start();
          api.injector.configure(options ?? {});
        },
        async getLayoutState() {
          return {
            cardsView:
              Services.prefs.getIntPref("mail.threadpane.listview", 0) == 0,
            verticalLayout:
              Services.prefs.getIntPref("mail.pane_config.dynamic", 0) == 2,
            threeLineCards:
              Services.prefs.getIntPref(
                "mail.threadpane.cardsview.rowcount",
                3
              ) == 3,
          };
        },
        async applyRecommendedLayout() {
          Services.prefs.setIntPref("mail.threadpane.listview", 0);
          Services.prefs.setIntPref("mail.pane_config.dynamic", 2);
          Services.prefs.setIntPref("mail.threadpane.cardsview.rowcount", 3);
        },
        async getAccounts() {
          return listMailAccounts();
        },
      },
    };
  }
};
