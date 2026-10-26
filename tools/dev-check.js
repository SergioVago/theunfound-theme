// Diagnóstico do addon no perfil de desenvolvimento: versão instalada, estado
// da substituição resource://, atributos de raiz, folhas carregadas e
// decoradores em cada documento relevante.
// Uso: python3 tools/tbctl.py exec --port 2850 --file tools/dev-check.js

const { AddonManager } = ChromeUtils.importESModule(
  "resource://gre/modules/AddonManager.sys.mjs"
);
const ID = "theme@theunfound.com.br";
const addon = await AddonManager.getAddonByID(ID);
const res = Services.io
  .getProtocolHandler("resource")
  .QueryInterface(Ci.nsIResProtocolHandler);

// Host da instância atual, lido do atributo unf-ui de messenger.xhtml.
const instance = document.documentElement.getAttribute("unf-ui");
const resources = {};
for (const host of [instance && `theunfound-theme-${instance}`.toLowerCase()]) {
  if (host) {
    resources[host] = res.hasSubstitution(host)
      ? res.getSubstitution(host).spec
      : null;
  }
}
const policy = WebExtensionPolicy.getByID(ID);

// As folhas extras (loadSheetUsingURIString) não aparecem em
// document.styleSheets: confere o efeito delas em um elemento de cada documento.
const PROBES = {
  "chrome://messenger/content/messenger.xhtml": ["#spacesToolbar", "background-color"],
  "about:3pane": ["#folderPane", "background-color"],
  "about:message": ["#messageHeader", "padding-top"],
};

function sheetsOf(doc) {
  const probe = PROBES[doc.documentURI];
  const el = probe && doc.querySelector(probe[0]);
  return el ? `${probe[0]} ${probe[1]}: ${doc.defaultView.getComputedStyle(el).getPropertyValue(probe[1])}` : null;
}

function describeDoc(doc) {
  if (!doc) {
    return null;
  }
  const root = doc.documentElement;
  const win = doc.defaultView;
  const describeDecorator = d =>
    d
      ? {
          instance: d.instance ?? null,
          version: d.version ?? null,
          active: d.isActive?.() ?? "?",
        }
      : null;
  return {
    uri: doc.documentURI.slice(0, 60),
    attrs: root
      .getAttributeNames()
      .filter(n => n.startsWith("unf-"))
      .map(n => `${n}=${root.getAttribute(n)}`),
    probe: sheetsOf(doc),
    decorator: describeDecorator(win?.UnfoundSkinDecorator),
  };
}

const tabmail = window.gTabmail;
const a3 = tabmail?.tabInfo[0]?.chromeBrowser?.contentWindow;
const am = a3?.messageBrowser?.contentWindow;
const cards = a3 ? [...a3.document.querySelectorAll("tr.card-layout")] : [];
const d3 = a3?.document;
const folderPane = d3?.getElementById("folderPane");

return {
  addon: addon
    ? {
        version: addon.version,
        active: addon.isActive,
        temp: addon.temporarilyInstalled,
        rootURI: policy?.extension?.rootURI?.spec ?? null,
      }
    : null,
  resources,
  rail: getComputedStyle(document.getElementById("spacesToolbar")).backgroundColor,
  messenger: describeDoc(document),
  about3pane: describeDoc(a3?.document),
  aboutMessage: describeDoc(am?.document),
  cards: {
    total: cards.length,
    avatars: cards.filter(r => r.querySelector(".unf-avatar")).length,
    previews: cards.filter(r => r.querySelector(".unf-preview:not(.is-empty)")).length,
    smartSenders: cards.filter(r => r.querySelector(".sender > .unf-sender-name")).length,
  },
  // Barra lateral (0.3.0): trilho de contas e largura do painel de pastas.
  sidebar: d3
    ? {
        folderPaneBg: folderPane ? a3.getComputedStyle(folderPane).backgroundColor : null,
        folderPaneWidth: folderPane ? Math.round(folderPane.getBoundingClientRect().width) : null,
        splitterWidthVar: d3.body.style.getPropertyValue("--folderPaneSplitter-width") || null,
        storedWidth: Services.xulStore.getValue("chrome://messenger/content/messenger.xhtml", "folderPaneBox", "width") || null,
        railCollapsedStored: Services.xulStore.getValue("chrome://messenger/content/messenger.xhtml", "unfFolderRail", "collapsed") || null,
        injectedNodes: d3.querySelectorAll(".unf-rail-injected").length,
        railAccounts: [...d3.querySelectorAll(".unf-rail-account")].map(b => {
          const badge = b.querySelector(".unf-rail-badge");
          return `${b.title.split("\n")[0]}${badge?.hidden ? "" : ` [${badge?.textContent}]`}${b.hasAttribute("aria-current") ? " *" : ""}`;
        }),
      }
    : null,
};
