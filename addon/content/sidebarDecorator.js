/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Carregado pelo experimento theUnfound Theme em cada janela principal
 * (messenger.xhtml). Cuida da barra lateral em todas as abas de e-mail
 * (about:3pane) da janela:
 *  - barra escura: põe `unf-light-sidebar` na raiz da janela e das abas
 *    quando a opção "Barra lateral escura" está desligada (o visual em si
 *    fica em skin/sidebar.css);
 *  - trilho de contas: um botão no topo do painel de pastas recolhe o painel
 *    num trilho estreito só com a foto de cada conta de e-mail, com o número
 *    de não lidas da Entrada. O estado fica no xulstore e vale para todas as
 *    janelas. A largura salva não é tocada: o CSS sobrepõe a variável do
 *    splitter enquanto o atributo `unf-folder-rail` estiver na raiz, e o
 *    decorador solta o painel da trava de tamanho do #messagePaneSplitter
 *    (resize-lock-ids), que grava essa largura inline com !important e
 *    venceria a folha.
 * Segue o protocolo de dono da 0.2.1: o experimento carrega este script como
 * window.UnfoundSkinDecorator, marca nele a instância dona (decorator.instance)
 * e o substitui/desinstala quando outra instância assume. Os atributos de raiz
 * (unf-light-sidebar, unf-folder-rail) levam o id dessa instância e, ao
 * desinstalar, só saem se ainda forem dela. Tudo é desfeito em uninstall():
 * nós, atributos, ouvintes e observadores.
 */

"use strict";

(function () {
  // Nome que o experimento usa para configurar/desinstalar o decorador.
  const GLOBAL = "UnfoundSkinDecorator";

  // O experimento já remove o decorador anterior antes de carregar este; se
  // ainda houver um (de outra instância), ele sai — nunca é reaproveitado.
  if (window[GLOBAL]) {
    try {
      window[GLOBAL].uninstall();
    } catch (e) {
      console.error("theUnfound Theme:", e);
    }
    delete window[GLOBAL];
  }

  const { MailServices } = ChromeUtils.importESModule(
    "resource:///modules/MailServices.sys.mjs"
  );

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const STORE_DOC = "chrome://messenger/content/messenger.xhtml";
  const STORE_ID = "unfFolderRail";
  // Avisa as outras janelas quando o trilho é recolhido/expandido.
  const RAIL_TOPIC = "theunfound-theme:folder-rail-changed";
  const INJECTED = "unf-rail-injected";
  const LIGHT_ATTRIBUTE = "unf-light-sidebar";
  const RAIL_ATTRIBUTE = "unf-folder-rail";
  // Trava de tamanho do #messagePaneSplitter e o painel que soltamos dela.
  const LOCK_ATTRIBUTE = "resize-lock-ids";
  const LOCK_TARGET = "folderPane";
  // Lista de resize-lock-ids de cada layout, igual à que o #setLayout do
  // pane-layout.mjs escreve (no clássico o painel de pastas é uma coluna de
  // altura cheia e fica de fora). A lista vem daqui, nunca do atributo: o que
  // estiver lá pode ser resto de outra instância ou de um layout anterior, e
  // viraria "original" para sempre.
  const LOCK_IDS = new Map([
    ["layout-classic", "threadPane"],
    ["layout-vertical", "threadPane,folderPane"],
    ["layout-wide", "threadPane,folderPane"],
  ]);
  const AB_TOPICS = [
    "addrbook-contact-created",
    "addrbook-contact-updated",
    "addrbook-contact-deleted",
    "addrbook-directory-created",
    "addrbook-directory-deleted",
    "addrbook-reloaded",
  ];
  // Só imagens embutidas vindas das opções (nada de URLs remotas).
  const CUSTOM_PHOTO = /^data:image\/(?:png|jpeg|webp|gif);base64,/;

  const options = { darkSidebar: true, accountPhotos: {} };
  // Janela about:3pane → estado do trilho daquela aba.
  const panes = new Map();
  const abPhotos = new Map();
  let active = true;
  // Só depois do primeiro configure() a instância dona é conhecida (o
  // experimento a grava no decorador logo após carregar o script).
  let ready = false;
  let collapsed = readCollapsed();
  let renderTimer = null;
  let decorator = null;
  const localOwner = `local-${Date.now().toString(36)}`;

  function owner() {
    return decorator?.instance ?? localOwner;
  }

  /**
   * Liga/desliga um atributo de raiz deste decorador. Enquanto ativo, ele é o
   * único decorador da janela e manda nesses atributos; ao desinstalar
   * (`onlyOwned`), só remove os que ainda carregam o id da sua instância.
   */
  function setOwnedAttribute(root, name, on, onlyOwned = false) {
    if (!root) {
      return;
    }
    if (on) {
      if (root.getAttribute(name) != owner()) {
        root.setAttribute(name, owner());
      }
    } else if (!onlyOwned || root.getAttribute(name) == owner()) {
      root.removeAttribute(name);
    }
  }

  // Matizes (OKLCH) dos avatares — a mesma conta do threadDecorator.js, para
  // a conta ter a mesma cor aqui e na lista de mensagens.
  const AVATAR_HUES = [255, 280, 305, 335, 10, 35, 60, 150, 175, 200, 225];

  function hueFor(key) {
    let hash = 0;
    for (const char of key.toLowerCase()) {
      hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    }
    return AVATAR_HUES[hash % AVATAR_HUES.length];
  }

  function initialsFor(name, email) {
    const source = (name || email.split("@")[0] || "?")
      .normalize()
      .replace(/[^\p{Letter}\p{Nd}\s]+/gu, " ")
      .trim();
    const words = source.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return "?";
    }
    const first = Array.from(words[0])[0] ?? "";
    const last = words.length > 1 ? Array.from(words.at(-1))[0] ?? "" : "";
    return (first + last).toUpperCase();
  }

  // ---------------------------------------------------------------------
  // Contas

  /**
   * Contas de e-mail na ordem do Thunderbird: as que têm identidade e Caixa
   * de entrada. Pastas locais, feeds, notícias e bate-papo ficam de fora (não
   * há Entrada para abrir nem contar).
   */
  function collectAccounts() {
    const list = [];
    for (const account of MailServices.accounts.accounts) {
      try {
        const server = account.incomingServer;
        const identity = account.defaultIdentity;
        if (!server || !identity || server.type == "none") {
          continue;
        }
        const inbox = server.rootMsgFolder?.getFolderWithFlags(
          Ci.nsMsgFolderFlags.Inbox
        );
        if (!inbox) {
          continue;
        }
        const email = identity.email || "";
        list.push({
          key: account.key,
          server,
          inbox,
          email,
          fullName: identity.fullName || "",
          name: server.prettyName || email,
          unread: Math.max(0, inbox.getNumUnread(false)),
        });
      } catch (e) {
        // Conta quebrada ou ainda carregando: fica fora do trilho.
      }
    }
    return list;
  }

  function abPhotoFor(email) {
    if (!email) {
      return "";
    }
    const key = email.toLowerCase();
    if (!abPhotos.has(key)) {
      let url = "";
      try {
        url = MailServices.ab.cardForEmailAddress(key)?.photoURL || "";
      } catch (e) {}
      abPhotos.set(key, url);
    }
    return abPhotos.get(key);
  }

  /** Foto da conta: imagem das opções › catálogo de endereços › iniciais. */
  function photoFor(entry) {
    const custom = options.accountPhotos?.[entry.key];
    if (typeof custom == "string" && CUSTOM_PHOTO.test(custom)) {
      return custom;
    }
    return abPhotoFor(entry.email);
  }

  function unreadText(count) {
    if (!count) {
      return "nenhuma não lida";
    }
    return count == 1 ? "1 não lida" : `${count} não lidas`;
  }

  // ---------------------------------------------------------------------
  // Estado recolhido (xulstore, compartilhado entre janelas)

  function readCollapsed() {
    try {
      return Services.xulStore.getValue(STORE_DOC, STORE_ID, "collapsed") == "true";
    } catch (e) {
      return false;
    }
  }

  function setCollapsed(value, focusPane = null) {
    try {
      Services.xulStore.setValue(STORE_DOC, STORE_ID, "collapsed", String(value));
    } catch (e) {
      console.error("theUnfound Theme:", e);
    }
    applyCollapsed(value, focusPane);
    Services.obs.notifyObservers(null, RAIL_TOPIC, String(value));
  }

  function applyCollapsed(value, focusPane = null) {
    collapsed = value;
    for (const pane of panes.values()) {
      applyPaneState(pane, pane === focusPane);
    }
  }

  // ---------------------------------------------------------------------
  // DOM em cada about:3pane

  function el(doc, tag, className, attributes = {}) {
    const node = doc.createElementNS(HTML_NS, tag);
    node.className = `${INJECTED} ${className}`;
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    return node;
  }

  function collapseButton(doc, pane) {
    const button = el(doc, "button", "button button-flat icon-button icon-only unf-rail-collapse", {
      type: "button",
      title: "Recolher painel de pastas (só as contas)",
      "aria-label": "Recolher painel de pastas",
      "aria-expanded": "true",
    });
    pane.listen(button, "click", () => setCollapsed(true, pane));
    return button;
  }

  function attach(win) {
    if (!active || !ready || panes.has(win)) {
      return;
    }
    const doc = win.document;
    const folderPaneEl = doc?.getElementById("folderPane");
    const header = doc?.getElementById("folderPaneHeaderBar");
    if (!folderPaneEl || !header) {
      return;
    }
    // Restos de uma instância anterior que não conseguiu se desfazer.
    for (const node of doc.querySelectorAll(`.${INJECTED}`)) {
      node.remove();
    }

    const pane = {
      win,
      doc,
      buttons: new Map(),
      cleanups: [],
      listen(target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
        this.cleanups.push(() => target.removeEventListener(type, handler, opts));
      },
    };

    // No cabeçalho (row-reverse): primeiro filho = canto direito. Os botões
    // nativos usam tabindex 1–3, então este vem logo depois deles.
    pane.headerToggle = collapseButton(doc, pane);
    pane.headerToggle.setAttribute("tabindex", "4");
    header.prepend(pane.headerToggle);

    // Reserva para quando o usuário esconde o cabeçalho do painel.
    pane.fallback = el(doc, "div", "unf-rail-fallback");
    pane.fallbackToggle = collapseButton(doc, pane);
    pane.fallback.append(pane.fallbackToggle);

    pane.rail = el(doc, "div", "unf-rail", {
      role: "navigation",
      "aria-label": "Contas",
    });
    pane.rail.hidden = true;
    pane.expand = el(doc, "button", "unf-rail-expand", {
      type: "button",
      title: "Expandir painel de pastas",
      "aria-label": "Expandir painel de pastas",
      "aria-expanded": "false",
    });
    pane.listen(pane.expand, "click", () => setCollapsed(false, pane));
    pane.compose = el(doc, "button", "unf-rail-compose", {
      type: "button",
      title: "Nova mensagem",
      "aria-label": "Nova mensagem",
    });
    pane.listen(pane.compose, "click", event => {
      try {
        win.top.MsgNewMessage(event);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    });
    pane.list = el(doc, "div", "unf-rail-accounts");
    pane.listen(pane.list, "keydown", event => onListKeydown(pane, event));
    pane.rail.append(
      pane.expand,
      pane.compose,
      el(doc, "div", "unf-rail-separator", { role: "presentation" }),
      pane.list
    );

    folderPaneEl.insertBefore(pane.fallback, header);
    folderPaneEl.insertBefore(pane.rail, header);

    pane.listen(win, "folderURIChanged", () => updateSelection(pane));
    pane.listen(win, "unload", () => detach(win, false), { once: true });

    // A troca de layout em runtime faz o pane-layout reescrever
    // resize-lock-ids (a lista certa depende do layout): o trilho tem que
    // soltar o painel de novo. Este observador também é o que acerta a trava
    // quando o attach chega antes do pane-layout (o atributo é escrito no
    // DOMContentLoaded do about:3pane, depois deste script).
    const splitter = doc.getElementById("messagePaneSplitter");
    if (splitter) {
      const lockObserver = new win.MutationObserver(() => {
        if (active && panes.get(win) === pane) {
          syncSplitterLock(pane);
        }
      });
      lockObserver.observe(splitter, { attributeFilter: [LOCK_ATTRIBUTE] });
      pane.cleanups.push(() => lockObserver.disconnect());

      // Painel de mensagem desligado/religado (Exibir > Layout > painel de
      // mensagens): enquanto ele está desligado o Thunderbird não trava nada
      // e a sincronia só mexe na lista; ao religar ele trava no que mediu, e
      // é aí que a sincronia volta a valer (ver syncSplitterLock).
      for (const type of ["splitter-collapsed", "splitter-expanded"]) {
        pane.listen(splitter, type, () => {
          if (active && panes.get(win) === pane) {
            syncSplitterLock(pane);
          }
        });
      }
    }

    // Com o painel fechado pelo splitter (F9) a trava fica como está — o
    // Thunderbird não sabe medir um painel em display:none (ver
    // syncSplitterLock). A sincronia espera o painel voltar.
    const folderSplitter = doc.getElementById("folderPaneSplitter");
    if (folderSplitter) {
      pane.listen(folderSplitter, "splitter-expanded", () => {
        if (active && panes.get(win) === pane) {
          syncSplitterLock(pane);
        }
      });
    }

    // F6 (SwitchPaneFocus) foca a árvore de pastas, que some no modo trilho:
    // o foco vai para a conta atual no trilho e, se já estiver lá, segue
    // para a lista, sem ficar preso.
    const tree = doc.getElementById("folderTree");
    if (tree) {
      const railFocus = function (...args) {
        if (active && collapsed && panes.get(win) === pane) {
          if (pane.rail.contains(doc.activeElement)) {
            const next = win.accountCentralBrowser?.hidden === false
              ? win.accountCentralBrowser
              : win.threadTree?.table?.body;
            next?.focus();
          } else {
            (pane.list.querySelector("[aria-current]") ?? pane.list.firstElementChild ?? pane.expand).focus();
          }
          return;
        }
        Object.getPrototypeOf(this).focus.apply(this, args);
      };
      tree.focus = railFocus;
      pane.cleanups.push(() => {
        if (tree.focus === railFocus) {
          delete tree.focus;
        }
      });
    }

    panes.set(win, pane);
    applyDarkSidebar(doc);
    renderPane(pane, collectAccounts());
    applyPaneState(pane, false);
  }

  function detach(win, restore = true) {
    const pane = panes.get(win);
    if (!pane) {
      return;
    }
    panes.delete(win);
    for (const cleanup of pane.cleanups) {
      try {
        cleanup();
      } catch (e) {}
    }
    if (!restore) {
      return;
    }
    try {
      for (const node of [pane.headerToggle, pane.fallback, pane.rail]) {
        node?.remove();
      }
      const root = pane.doc.documentElement;
      setOwnedAttribute(root, RAIL_ATTRIBUTE, false, true);
      setOwnedAttribute(root, LIGHT_ATTRIBUTE, false, true);
    } catch (e) {
      // Documento já descarregado.
    }
    // Num try próprio: a lista da trava é o que fica para o Thunderbird depois
    // que o addon sai, e não pode ficar de fora porque um nó já descarregado
    // quebrou o passo anterior. `force` devolve a lista mesmo com o painel
    // fechado pelo splitter — quem está saindo não tem como esperar o painel
    // voltar.
    try {
      syncSplitterLock(pane, false, true);
    } catch (e) {
      // Documento já descarregado.
    }
  }

  function applyPaneState(pane, moveFocus) {
    const { doc, rail } = pane;
    const focused = doc.activeElement;
    const inRail = rail.contains(focused);
    const inTree = !inRail && !!doc.getElementById("folderPane")?.contains(focused);
    setOwnedAttribute(doc.documentElement, RAIL_ATTRIBUTE, collapsed);
    rail.hidden = !collapsed;
    // Com o atributo de raiz já no lugar — a largura do painel é a do modo
    // atual —, solta ou devolve a trava do splitter.
    syncSplitterLock(pane);
    // O foco não pode ficar num elemento que acabou de sumir.
    try {
      if (collapsed && (moveFocus || inTree)) {
        pane.expand.focus();
      } else if (!collapsed && (moveFocus || inRail)) {
        (doc.getElementById("folderPaneHeaderBar")?.hidden
          ? pane.fallbackToggle
          : pane.headerToggle
        ).focus();
      }
    } catch (e) {}
  }

  function applyDarkSidebar(doc) {
    setOwnedAttribute(doc.documentElement, LIGHT_ATTRIBUTE, !options.darkSidebar);
  }

  // ---------------------------------------------------------------------
  // Trava de tamanho do #messagePaneSplitter
  //
  // Esse splitter tem resize-with-window e, no layout vertical,
  // resize-lock-ids="threadPane,folderPane": ao restaurar a largura no startup
  // ou ao terminar um arrasto, o pane-splitter grava no #folderPane um
  // `width: <largura salva>px !important` inline. Inline com !important vence
  // !important de folha de autor, e a coluna do grid é
  // `minmax(auto, var(--folderPaneSplitter-width))` — com o item tendo largura
  // definida, o mínimo `auto` da trilha vira a largura salva e anula o máximo
  // do trilho que o CSS pede. No modo trilho tiramos "folderPane" da lista: o
  // próprio pane-splitter apaga o inline de quem sai dela, e a largura salva no
  // xulstore não é tocada (quem grava lá é o evento splitter-resized, só no fim
  // de um arrasto).
  //
  // Devolver a lista é mais delicado do que tirar, porque o Thunderbird remede
  // tudo quando ela volta e só trava se o que mediu bater com a largura salva:
  // guardamos o inline que ele tinha (rememberLockStyles) e o devolvemos
  // (restoreSplitterLock), em vez de pedir uma re-derivação que não cabe em
  // janela estreita nem funciona com o painel fechado pelo splitter.
  //
  // E há dois estados em que o Thunderbird não tem trava nenhuma, e em que
  // devolver uma seria inventar inline que ele não escreveria e não apagaria:
  // o painel de pastas fechado pelo splitter (F9), que ele não consegue medir,
  // e o painel de mensagem desligado, em que ele destrava de propósito. Nos
  // dois a sincronia espera o painel voltar.

  function lockIdList(value) {
    return (value ?? "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);
  }

  /** Painel de pastas fechado pelo splitter (F9): está em display:none. */
  function folderPaneHidden(pane) {
    return !!pane.doc
      .getElementById("folderPane")
      ?.classList.contains("collapsed-by-splitter");
  }

  /**
   * A propriedade que a trava grava, pela mesma conta do #resizeProperty do
   * pane-splitter.js: altura quando o splitter é vertical (clássico e largo),
   * largura quando é horizontal (vertical). Só a trava de largura briga com o
   * trilho, mas quem lê e escreve tem que usar a propriedade do layout atual —
   * um "width" gravado num layout de altura é um inline que o Thunderbird
   * nunca escreveria e, por não estar na conta dele, nunca apagaria.
   */
  function lockProperty(splitter) {
    return splitter.resizeDirection == "vertical" ? "height" : "width";
  }

  function lockStyle(pane, id, property) {
    return pane.doc.getElementById(id)?.style.getPropertyValue(property) ?? "";
  }

  /** Grava o tamanho da trava como o Thunderbird grava: inline e !important. */
  function writeLockStyle(pane, id, property, value) {
    const el = pane.doc.getElementById(id);
    if (!el) {
      return;
    }
    if (value) {
      el.style.setProperty(property, value, "important");
    } else {
      el.style.removeProperty(property);
    }
  }

  /**
   * Apaga o estilo inline que a trava deixou. Por padrão só no #folderPane: é
   * o único painel que o trilho solta, e o #threadPane segue travado pelo
   * Thunderbird. As duas propriedades saem juntas porque uma troca de layout
   * troca o eixo e pode deixar a do eixo anterior para trás. O valor antigo
   * sai do caminho porque é o tamanho de antes: quem o devolve é
   * restoreSplitterLock, e só quando o retrato ainda vale.
   */
  function clearLockStyle(pane, ids = [LOCK_TARGET]) {
    for (const id of ids) {
      const el = pane.doc.getElementById(id);
      for (const property of ["width", "height"]) {
        if (el?.style.getPropertyValue(property)) {
          el.style.removeProperty(property);
        }
      }
    }
  }

  /**
   * Retrato do que o Thunderbird tinha travado pouco antes de o trilho soltar
   * o painel: o inline de cada painel da lista, mais o que diz se o retrato
   * ainda vale — o eixo da trava, o tamanho do painel de mensagem e a largura
   * salva do painel de pastas (um arrasto de qualquer um dos dois no modo
   * trilho muda esses números e aposenta o retrato). Só vale com o painel de
   * pastas na largura salva: no modo trilho — janela que já abre recolhida,
   * troca de layout — o inline é o da largura estreita ou nem existe, e
   * devolvê-lo prenderia o painel no trilho.
   *
   * O retrato velho é jogado fora antes de qualquer teste: um retrato tirado
   * num estado válido não pode sobreviver para um estado em que ele é mentira
   * (era o que acontecia com o painel de mensagem desligado — o Thunderbird
   * destravava tudo, não havia o que retratar, e o retrato da volta anterior
   * ficava de pé).
   */
  function rememberLockStyles(pane, splitter, ids) {
    pane.lockSnapshot = null;
    const property = lockProperty(splitter);
    const saved = pane.doc.getElementById("folderPaneSplitter")?.width;
    const styles = new Map(ids.map(id => [id, lockStyle(pane, id, property)]));
    if (
      saved == null ||
      styles.get(LOCK_TARGET) != `${saved}px` ||
      [...styles.values()].some(value => !value)
    ) {
      return;
    }
    pane.lockSnapshot = {
      property,
      messageSize: splitter[property],
      folderWidth: saved,
      styles,
    };
  }

  /**
   * Faz o Thunderbird refazer a trava a partir dos tamanhos salvos, como o
   * pane-layout faz ao restaurar o xulstore (#setValues): destrava tudo,
   * remede e trava de novo. Nada é gravado no xulstore — lá só escreve o
   * evento splitter-resized, no fim de um arrasto.
   */
  function relockSize(splitter, property) {
    const size = splitter[property];
    if (size == null) {
      // Sem tamanho salvo não há trava: o Thunderbird nem travou nada.
      return;
    }
    splitter[property] = null;
    splitter[property] = size;
  }

  /**
   * Devolve a lista original e, com ela, a trava que o Thunderbird tinha.
   *
   * Com o retrato ainda válido basta repor os inlines: o Thunderbird remede
   * (largura definida é a medida) e trava nos mesmos valores, sem re-derivar
   * nada — é o que mantém a largura salva numa janela que encolheu, onde a
   * re-derivação não cabe e o Thunderbird desiste no meio, deixando
   * --messagePaneSplitter-width preso em px.
   *
   * Sem retrato — a janela abriu já recolhida, ou o painel de mensagem mudou
   * de largura no modo trilho — resta re-derivar. Aí a largura salva vai antes
   * para o #folderPane: é o valor que o próprio Thunderbird grava, e sem ele a
   * coluna só chega lá quando sobra espaço de sobra.
   */
  function restoreSplitterLock(pane, splitter, wanted) {
    const property = lockProperty(splitter);
    const saved = pane.doc.getElementById("folderPaneSplitter")?.width;
    const snapshot = pane.lockSnapshot;
    if (
      snapshot &&
      snapshot.property == property &&
      snapshot.messageSize == splitter[property] &&
      snapshot.folderWidth == saved
    ) {
      for (const [id, value] of snapshot.styles) {
        writeLockStyle(pane, id, property, value);
      }
      splitter.setAttribute(LOCK_ATTRIBUTE, wanted);
      return;
    }
    clearLockStyle(pane);
    // A largura salva só serve de palpite no eixo da largura; no de altura
    // (clássico e largo) quem mede é o Thunderbird, e um "height" nosso aqui
    // ficaria para sempre.
    if (property == "width" && saved > 0) {
      writeLockStyle(pane, LOCK_TARGET, property, `${saved}px`);
    }
    // Com o painel em display:none não há o que re-derivar: o Thunderbird
    // mediria 0 (ver syncSplitterLock). A largura salva acima já é o que ele
    // encontra quando o painel voltar.
    if (!folderPaneHidden(pane)) {
      relockSize(splitter, property);
    }
    splitter.setAttribute(LOCK_ATTRIBUTE, wanted);
  }

  /**
   * Deixa a trava no estado que o modo atual pede: sem o #folderPane enquanto
   * o trilho estiver recolhido, com a lista do Thunderbird no resto.
   * Idempotente — serve para o attach, para recolher e expandir, para a
   * reescrita que o pane-layout faz na troca de layout e para o detach
   * (`force`).
   */
  function syncSplitterLock(pane, release = collapsed, force = false) {
    const splitter = pane.doc.getElementById("messagePaneSplitter");
    // Sem o atributo o pane-layout ainda não configurou o splitter (o
    // about:3pane nasce sem ele): não há lista para soltar nem devolver, e o
    // observador do attach chama de novo quando ela chegar.
    if (!splitter?.hasAttribute(LOCK_ATTRIBUTE)) {
      return;
    }
    const original = LOCK_IDS.get(
      [...pane.doc.body.classList].find(name => LOCK_IDS.has(name))
    );
    // Layout que este addon não conhece: a lista é do Thunderbird e fica como
    // está — o máximo do CSS segura a largura do trilho sozinho.
    if (original == null) {
      return;
    }
    const ids = lockIdList(original);
    // Só trava de largura briga com o trilho. Nos layouts clássico e largo o
    // splitter trava altura (resize-direction vertical) e o painel de pastas
    // fica exatamente como o Thunderbird o deixou.
    const releasable =
      lockProperty(splitter) == "width" && ids.includes(LOCK_TARGET);
    const wanted =
      release && releasable ? ids.filter(id => id != LOCK_TARGET).join(",") : original;
    // Painel de mensagem desligado (Exibir > Layout > painel de mensagens):
    // com o #messagePaneSplitter colapsado o Thunderbird destrava tudo de
    // propósito — o lock do #updateLockElements é `#resizeWithWindowActive &&
    // !this.isCollapsed` (pane-splitter.js:144) — e não deixa um inline
    // sequer. Então não há trava para guardar nem para devolver: a lista vai e
    // volta sozinha, e o que estiver inline nos painéis da lista é mentira e
    // sai. O retrato também, porque nesse estado nada mais vigia a geometria
    // (a janela pode ser redimensionada sem mexer na largura do painel de
    // mensagem, que é o que aposenta o retrato). Vale inclusive para o detach:
    // escrever aqui deixaria para trás um inline que o Thunderbird não
    // escreveria nem apagaria. Quando o painel voltar, o splitter-expanded do
    // attach chama de novo — e aí o Thunderbird já travou no que mediu.
    if (splitter.isCollapsed) {
      pane.lockSnapshot = null;
      clearLockStyle(pane, ids);
      if (splitter.getAttribute(LOCK_ATTRIBUTE) != wanted) {
        splitter.setAttribute(LOCK_ATTRIBUTE, wanted);
      }
      return;
    }
    if (splitter.getAttribute(LOCK_ATTRIBUTE) == wanted) {
      return;
    }
    // Painel fechado pelo splitter (F9): em display:none ele mede 0, o
    // Thunderbird desiste de travar depois de ~60 quadros e deixa o
    // #threadPane preso numa largura medida sem o painel de pastas (e
    // --messagePaneSplitter-width em px). Esperamos o painel voltar — o
    // splitter-expanded do attach chama de novo. Só o detach não pode esperar.
    if (folderPaneHidden(pane) && !force) {
      return;
    }
    if (release) {
      rememberLockStyles(pane, splitter, ids);
      clearLockStyle(pane);
      splitter.setAttribute(LOCK_ATTRIBUTE, wanted);
      return;
    }
    restoreSplitterLock(pane, splitter, wanted);
  }

  // ---------------------------------------------------------------------
  // Botões das contas

  function currentServerKey(pane) {
    try {
      return pane.win.gFolder?.server?.key ?? null;
    } catch (e) {
      return null;
    }
  }

  function updateSelection(pane) {
    const serverKey = currentServerKey(pane);
    for (const button of pane.buttons.values()) {
      const current = !!serverKey && button.dataset.serverKey == serverKey;
      if (current) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function updateAvatar(avatar, entry) {
    const photo = photoFor(entry);
    const label = entry.fullName || entry.name;
    const signature = `${photo.length}|${photo.slice(-64)}|${label}|${entry.email}`;
    if (avatar.dataset.signature == signature) {
      return;
    }
    avatar.dataset.signature = signature;
    avatar.replaceChildren();
    avatar.classList.toggle("has-photo", !!photo);
    avatar.style.setProperty(
      "--unf-avatar-hue",
      hueFor((entry.email || entry.name || "?").toLowerCase())
    );
    const initials = initialsFor(label, entry.email);
    if (photo) {
      const img = avatar.ownerDocument.createElementNS(HTML_NS, "img");
      img.alt = "";
      img.src = photo;
      img.addEventListener(
        "error",
        () => {
          avatar.classList.remove("has-photo");
          avatar.textContent = initials;
        },
        { once: true }
      );
      avatar.append(img);
    } else {
      avatar.textContent = initials;
    }
  }

  function createAccountButton(pane, key) {
    const { doc } = pane;
    const button = el(doc, "button", "unf-rail-account", { type: "button" });
    button.dataset.accountKey = key;
    button.append(
      el(doc, "span", "unf-rail-avatar", { "aria-hidden": "true" }),
      el(doc, "span", "unf-rail-badge", { "aria-hidden": "true" })
    );
    pane.listen(button, "click", () => openInbox(pane, button.dataset.accountKey));
    return button;
  }

  function renderPane(pane, accounts) {
    const keys = new Set(accounts.map(a => a.key));
    for (const [key, button] of pane.buttons) {
      if (!keys.has(key)) {
        button.remove();
        pane.buttons.delete(key);
      }
    }
    for (const entry of accounts) {
      let button = pane.buttons.get(entry.key);
      if (!button) {
        button = createAccountButton(pane, entry.key);
        pane.buttons.set(entry.key, button);
      }
      button.dataset.serverKey = entry.server.key;
      const lines = [entry.name];
      if (entry.email && entry.email.toLowerCase() != entry.name.toLowerCase()) {
        lines.push(entry.email);
      } else if (entry.fullName) {
        lines.unshift(entry.fullName);
      }
      const unread = unreadText(entry.unread);
      lines.push(unread.charAt(0).toUpperCase() + unread.slice(1));
      button.title = lines.join("\n");
      button.setAttribute(
        "aria-label",
        `${entry.name}${entry.email && entry.email != entry.name ? ` (${entry.email})` : ""}: Caixa de entrada, ${unread}`
      );
      updateAvatar(button.querySelector(".unf-rail-avatar"), entry);
      const badge = button.querySelector(".unf-rail-badge");
      badge.textContent = entry.unread > 99 ? "99+" : String(entry.unread);
      badge.hidden = entry.unread <= 0;
    }
    // Reordena só se preciso (mover um nó tira o foco dele).
    const order = accounts.map(a => pane.buttons.get(a.key));
    const same =
      order.length == pane.list.children.length &&
      order.every((button, i) => pane.list.children[i] === button);
    if (!same) {
      const focused = pane.doc.activeElement;
      pane.list.replaceChildren(...order);
      if (focused && order.includes(focused)) {
        focused.focus();
      }
    }
    updateSelection(pane);
  }

  function renderAll() {
    renderTimer = null;
    if (!active) {
      return;
    }
    const accounts = collectAccounts();
    for (const pane of panes.values()) {
      try {
        renderPane(pane, accounts);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    }
  }

  function scheduleRender() {
    if (active && !renderTimer) {
      renderTimer = setTimeout(renderAll, 60);
    }
  }

  function openInbox(pane, accountKey) {
    const entry = collectAccounts().find(a => a.key == accountKey);
    if (!entry) {
      return;
    }
    try {
      pane.win.displayFolder(entry.inbox);
    } catch (e) {
      console.error("theUnfound Theme:", e);
    }
    updateSelection(pane);
  }

  // Setas para cima/baixo, Home e End passeiam pelas contas.
  function onListKeydown(pane, event) {
    const buttons = [...pane.list.children];
    const index = buttons.indexOf(pane.doc.activeElement);
    if (index < 0) {
      return;
    }
    let next = null;
    switch (event.key) {
      case "ArrowDown":
        next = buttons[Math.min(buttons.length - 1, index + 1)];
        break;
      case "ArrowUp":
        next = buttons[Math.max(0, index - 1)];
        break;
      case "Home":
        next = buttons[0];
        break;
      case "End":
        next = buttons.at(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
    next?.focus();
  }

  // ---------------------------------------------------------------------
  // Ouvintes globais

  const folderListener = {
    QueryInterface: ChromeUtils.generateQI(["nsIFolderListener"]),
    onFolderAdded(parent, child) {
      if (parent?.isServer || child?.flags & Ci.nsMsgFolderFlags.Inbox) {
        scheduleRender();
      }
    },
    onMessageAdded() {},
    onFolderRemoved(parent, child) {
      if (parent?.isServer || child?.flags & Ci.nsMsgFolderFlags.Inbox) {
        scheduleRender();
      }
    },
    onMessageRemoved() {},
    onFolderPropertyChanged(folder, property) {
      if (property == "Name" && folder?.isServer) {
        scheduleRender();
      }
    },
    onFolderIntPropertyChanged(folder, property, oldValue, newValue) {
      if (property == "FolderFlag") {
        if ((oldValue ^ newValue) & Ci.nsMsgFolderFlags.Inbox) {
          scheduleRender();
        }
        return;
      }
      if (
        property == "TotalUnreadMessages" &&
        oldValue != newValue &&
        folder?.flags & Ci.nsMsgFolderFlags.Inbox
      ) {
        scheduleRender();
      }
    },
    onFolderBoolPropertyChanged(folder, property) {
      if (property == "isDeferred") {
        scheduleRender();
      }
    },
    onFolderUnicharPropertyChanged() {},
    onFolderPropertyFlagChanged() {},
    onFolderEvent() {},
  };

  const observer = {
    observe(subject, topic, data) {
      if (topic == RAIL_TOPIC) {
        const value = data == "true";
        if (value != collapsed) {
          applyCollapsed(value);
        }
        return;
      }
      if (topic == "nsPref:changed") {
        // Contas criadas, removidas ou reordenadas; nome/e-mail de identidade;
        // nome da conta.
        if (
          data == "mail.accountmanager.accounts" ||
          /^mail\.account\.[^.]+\.identities$/.test(data) ||
          /^mail\.identity\.[^.]+\.(?:fullName|useremail)$/.test(data) ||
          /^mail\.server\.[^.]+\.name$/.test(data)
        ) {
          scheduleRender();
        }
        return;
      }
      // Catálogo de endereços: a foto de uma conta pode ter mudado.
      abPhotos.clear();
      scheduleRender();
    },
  };

  const PREF_BRANCHES = [
    "mail.accountmanager.accounts",
    "mail.account.",
    "mail.identity.",
    "mail.server.",
  ];

  function onDocumentLoaded(event) {
    const doc = event.target;
    if (doc?.documentURI == "about:3pane" && doc.defaultView) {
      try {
        attach(doc.defaultView);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    }
  }

  function attachExisting() {
    for (const browser of document.querySelectorAll("browser")) {
      try {
        const doc = browser.contentDocument;
        if (doc?.documentURI == "about:3pane" && doc.readyState != "loading") {
          attach(doc.defaultView);
        }
      } catch (e) {}
    }
  }

  function install() {
    // Abas abertas depois: o DOMContentLoaded de about:3pane chega até aqui.
    window.addEventListener("DOMContentLoaded", onDocumentLoaded, true);
    window.addEventListener("unload", uninstall, { once: true });
    MailServices.mailSession.AddFolderListener(
      folderListener,
      Ci.nsIFolderListener.added |
        Ci.nsIFolderListener.removed |
        Ci.nsIFolderListener.propertyChanged |
        Ci.nsIFolderListener.intPropertyChanged |
        Ci.nsIFolderListener.boolPropertyChanged
    );
    for (const branch of PREF_BRANCHES) {
      Services.prefs.addObserver(branch, observer);
    }
    for (const topic of [RAIL_TOPIC, ...AB_TOPICS]) {
      Services.obs.addObserver(observer, topic);
    }
    // Atributos e trilho só no primeiro configure(), já com o dono definido.
  }

  function configure(newOptions) {
    if (!active) {
      return;
    }
    if (typeof newOptions?.darkSidebar == "boolean") {
      options.darkSidebar = newOptions.darkSidebar;
    }
    if (newOptions?.accountPhotos && typeof newOptions.accountPhotos == "object") {
      options.accountPhotos = { ...newOptions.accountPhotos };
    }
    ready = true;
    applyDarkSidebar(document);
    for (const pane of panes.values()) {
      applyDarkSidebar(pane.doc);
    }
    // Abas que carregaram antes de o decorador existir.
    attachExisting();
    scheduleRender();
  }

  function uninstall() {
    if (!active) {
      return;
    }
    active = false;
    clearTimeout(renderTimer);
    renderTimer = null;
    window.removeEventListener("DOMContentLoaded", onDocumentLoaded, true);
    window.removeEventListener("unload", uninstall, { once: true });
    try {
      MailServices.mailSession.RemoveFolderListener(folderListener);
    } catch (e) {}
    for (const branch of PREF_BRANCHES) {
      try {
        Services.prefs.removeObserver(branch, observer);
      } catch (e) {}
    }
    for (const topic of [RAIL_TOPIC, ...AB_TOPICS]) {
      try {
        Services.obs.removeObserver(observer, topic);
      } catch (e) {}
    }
    for (const win of [...panes.keys()]) {
      detach(win, true);
    }
    abPhotos.clear();
    setOwnedAttribute(document.documentElement, LIGHT_ATTRIBUTE, false, true);
    if (window[GLOBAL] === decorator) {
      delete window[GLOBAL];
    }
  }

  // Mesmo formato dos outros decoradores: o experimento grava `instance` e
  // `version` neste objeto e consulta isActive() antes de reaproveitá-lo.
  decorator = {
    configure,
    uninstall,
    isActive: () => active,
  };
  window[GLOBAL] = decorator;
  install();
})();
