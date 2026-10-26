/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Carregado pelo experimento theUnfound Theme dentro de cada janela about:3pane.
 * Acrescenta aos cartões da lista de mensagens o avatar do remetente, uma
 * linha de prévia do conteúdo e mostra o remetente no modo escolhido (nome
 * inteligente, nome e endereço ou só o nome — ver SenderTrust.sys.mjs). Não
 * altera nenhum dado: apenas decora as linhas já renderizadas pelo
 * Thunderbird. Tudo é desfeito em UnfoundSkinDecorator.uninstall().
 */

/* global threadTree, threadPane */

"use strict";

(function () {
  // O experimento remove qualquer decorador anterior antes de carregar este.
  if (window.UnfoundSkinDecorator) {
    return;
  }

  const { MailServices } = ChromeUtils.importESModule(
    "resource:///modules/MailServices.sys.mjs"
  );

  const AB_TOPICS = [
    "addrbook-contact-created",
    "addrbook-contact-updated",
    "addrbook-contact-deleted",
    "addrbook-directory-created",
    "addrbook-directory-deleted",
    "addrbook-reloaded",
    "addrbook-displayname-changed",
  ];
  const SENDER_MODES = ["smart", "full", "name"];
  const EXTRA_ROW_HEIGHT = 2;
  const MAX_PREVIEW_BATCH = 40;

  const options = { avatars: true, previews: true, senderDisplay: "smart" };
  const photoCache = new Map();
  const pendingPreviews = new Map();
  const attemptedPreviews = new Set();
  let previewTimer = null;
  let active = true;
  let ThreadCard = null;
  let originalFillRow = null;
  let wrappedFillRow = null;
  let originalDensityChange = null;
  let wrappedDensityChange = null;
  let Trust = null;

  const abObserver = {
    observe() {
      photoCache.clear();
      Trust?.invalidate();
      refresh();
    },
  };

  // Matizes (OKLCH) agradáveis para os avatares; evita os tons oliva.
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

  // fillRow roda muito (lista virtualizada): guarda o resultado do parser
  // por texto de cabeçalho.
  const parsedHeaders = new Map();

  function parseAddresses(header) {
    if (!header) {
      return [];
    }
    let parsed = parsedHeaders.get(header);
    if (!parsed) {
      try {
        parsed = MailServices.headerParser
          .parseDecodedHeader(header)
          .map(a => ({ name: a.name?.trim() || "", email: a.email?.trim() || "" }));
      } catch (e) {
        parsed = [];
      }
      if (parsedHeaders.size > 2000) {
        parsedHeaders.clear();
      }
      parsedHeaders.set(header, parsed);
    }
    return parsed;
  }

  /**
   * Quem a linha do remetente representa: o autor ou, em mensagens enviadas,
   * os destinatários — a mesma lista que o Thunderbird escolheu mostrar.
   */
  function displayedPeople(hdr, senderText, outgoing) {
    const authors = parseAddresses(hdr.mime2DecodedAuthor);
    const recipients = parseAddresses(hdr.mime2DecodedRecipients);
    const text = (senderText || "").toLowerCase();
    const shows = list =>
      list.some(
        p =>
          (p.email && text.includes(p.email.toLowerCase())) ||
          (p.name && text.includes(p.name.toLowerCase()))
      );
    if (outgoing && recipients.length && (shows(recipients) || !shows(authors))) {
      return recipients;
    }
    if (authors.length) {
      return authors;
    }
    return recipients;
  }

  const SEGMENT_CLASSES = {
    name: "unf-sender-name",
    domain: "unf-sender-domain",
    address: "unf-sender-address",
    "suspicious-address": "unf-suspicious-address",
    "claimed-name": "unf-sender-claimed-name",
    separator: "unf-sender-separator",
    alert: "unf-sender-alert",
  };

  /** Reescreve a linha do remetente a partir dos segmentos do SenderTrust. */
  function renderSender(senderLine, people) {
    const description = Trust.describe(people, options.senderDisplay);
    const nodes = description.segments.map(segment => {
      const span = document.createElement("span");
      span.className = SEGMENT_CLASSES[segment.type] || "";
      span.textContent = segment.text;
      if (segment.type == "alert") {
        span.setAttribute("role", "img");
        span.setAttribute("aria-label", "Remetente suspeito");
      }
      return span;
    });
    senderLine.replaceChildren(...nodes);
    senderLine.title = description.title;
    senderLine.classList.toggle("unf-suspicious", description.suspicious);
  }

  function photoFor(email) {
    if (!email) {
      return "";
    }
    const key = email.toLowerCase();
    if (!photoCache.has(key)) {
      let url = "";
      try {
        url = MailServices.ab.cardForEmailAddress(key)?.photoURL || "";
      } catch (e) {}
      photoCache.set(key, url);
    }
    return photoCache.get(key);
  }

  function cleanPreview(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function previewsEnabled() {
    return options.previews && !threadTree.classList.contains("cards-row-compact");
  }

  function updateAvatar(avatar, person) {
    const key = (person.email || person.name || "?").toLowerCase();
    const photo = photoFor(person.email);
    const signature = `${key}|${photo}|${person.name}`;
    if (avatar.dataset.signature == signature) {
      return;
    }
    avatar.dataset.signature = signature;
    avatar.replaceChildren();
    avatar.classList.toggle("has-photo", !!photo);
    avatar.style.setProperty("--unf-avatar-hue", hueFor(key));
    if (photo) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = photo;
      img.addEventListener(
        "error",
        () => {
          avatar.classList.remove("has-photo");
          avatar.textContent = initialsFor(person.name, person.email);
        },
        { once: true }
      );
      avatar.appendChild(img);
    } else {
      avatar.textContent = initialsFor(person.name, person.email);
    }
  }

  function decorate(row) {
    if (!active) {
      return;
    }
    const container = row.querySelector(".card-container");
    const dynamicRow = row.querySelector(".thread-card-dynamic-row");
    if (!container || !dynamicRow) {
      return;
    }
    let avatar = container.querySelector(":scope > .unf-avatar");
    let preview = dynamicRow.querySelector(":scope > .unf-preview");
    const properties = (row.dataset.properties || "").split(" ");

    if (properties.includes("dummy")) {
      avatar?.remove();
      preview?.remove();
      return;
    }

    let hdr = null;
    try {
      hdr = row.view?.getMsgHdrAt(row._index);
    } catch (e) {}
    if (!hdr) {
      return;
    }
    const senderText = row.senderLine?.textContent ?? "";
    const people = displayedPeople(
      hdr,
      senderText,
      properties.includes("outgoing")
    );
    const person = people[0] || { name: senderText, email: "" };

    row.senderLine?.classList.remove("unf-suspicious");
    if (Trust && row.senderLine && people.some(p => p.email)) {
      try {
        renderSender(row.senderLine, people);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    }

    if (options.avatars) {
      if (!avatar) {
        avatar = document.createElement("span");
        avatar.className = "unf-avatar";
        avatar.setAttribute("aria-hidden", "true");
        container.insertBefore(avatar, container.children[1] ?? null);
      }
      updateAvatar(avatar, person);
    } else {
      avatar?.remove();
    }

    if (previewsEnabled()) {
      if (!preview) {
        preview = document.createElement("span");
        preview.className = "unf-preview";
        dynamicRow.appendChild(preview);
      }
      const text = cleanPreview(hdr.getStringProperty("preview"));
      preview.textContent = text;
      preview.classList.toggle("is-empty", !text);
      if (!text) {
        requestPreview(hdr);
      }
    } else {
      preview?.remove();
    }
  }

  function requestPreview(hdr) {
    const folder = hdr.folder;
    if (!folder) {
      return;
    }
    const id = `${folder.URI}#${hdr.messageKey}`;
    if (attemptedPreviews.has(id)) {
      return;
    }
    attemptedPreviews.add(id);
    if (!pendingPreviews.has(folder.URI)) {
      pendingPreviews.set(folder.URI, { folder, keys: new Set() });
    }
    pendingPreviews.get(folder.URI).keys.add(hdr.messageKey);
    if (!previewTimer) {
      previewTimer = setTimeout(flushPreviews, 250);
    }
  }

  function flushPreviews() {
    previewTimer = null;
    const batches = [...pendingPreviews.values()];
    pendingPreviews.clear();
    for (const { folder, keys } of batches) {
      const list = [...keys].slice(0, MAX_PREVIEW_BATCH);
      let isAsync = false;
      try {
        isAsync = folder.fetchMsgPreviewText(list, {
          OnStartRunningUrl() {},
          OnStopRunningUrl() {
            refreshPreviews();
          },
        });
      } catch (e) {
        // Algumas pastas (ex. grupos de notícias) não oferecem prévia.
      }
      if (!isAsync) {
        refreshPreviews();
      }
    }
  }

  function visibleRows() {
    return [...(threadTree?.table?.body?.children ?? [])].filter(row =>
      row.classList?.contains("card-layout")
    );
  }

  function refreshPreviews() {
    if (!active || !previewsEnabled()) {
      return;
    }
    for (const row of visibleRows()) {
      const preview = row.querySelector(".unf-preview");
      if (!preview) {
        continue;
      }
      let hdr = null;
      try {
        hdr = row.view?.getMsgHdrAt(row._index);
      } catch (e) {}
      const text = cleanPreview(hdr?.getStringProperty("preview"));
      if (text && preview.textContent != text) {
        preview.textContent = text;
        preview.classList.remove("is-empty");
      }
    }
  }

  function refresh() {
    try {
      threadTree?.invalidate();
    } catch (e) {}
  }

  function resizeRows() {
    try {
      threadPane?.updateThreadItemSize();
    } catch (e) {}
  }

  async function install() {
    await customElements.whenDefined("thread-card");
    if (!active) {
      return;
    }
    ThreadCard = customElements.get("thread-card");
    originalFillRow = ThreadCard.prototype.fillRow;
    wrappedFillRow = function (...args) {
      originalFillRow.apply(this, args);
      try {
        decorate(this);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    };
    ThreadCard.prototype.fillRow = wrappedFillRow;

    // Um pouco mais de respiro vertical nos cartões: a linha de prévia só cabe
    // com a altura maior.
    if (typeof threadPane?.densityChange == "function") {
      originalDensityChange = threadPane.densityChange;
      wrappedDensityChange = async function (...args) {
        await originalDensityChange.apply(this, args);
        if (active && previewsEnabled()) {
          ThreadCard.ROW_HEIGHT += EXTRA_ROW_HEIGHT;
        }
      };
      threadPane.densityChange = wrappedDensityChange;
    }

    for (const topic of AB_TOPICS) {
      Services.obs.addObserver(abObserver, topic);
    }
    resizeRows();
    refresh();
  }

  function configure(newOptions) {
    const before = JSON.stringify(options);
    for (const key of ["avatars", "previews"]) {
      if (typeof newOptions?.[key] == "boolean") {
        options[key] = newOptions[key];
      }
    }
    if (SENDER_MODES.includes(newOptions?.senderDisplay)) {
      options.senderDisplay = newOptions.senderDisplay;
    }
    let trustLoaded = false;
    if (!Trust && newOptions?.trustModuleURL) {
      try {
        Trust = ChromeUtils.importESModule(newOptions.trustModuleURL);
        trustLoaded = true;
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    }
    // Identidades podem ter mudado desde a última vez.
    Trust?.invalidate();
    if (ThreadCard && (trustLoaded || before != JSON.stringify(options))) {
      resizeRows();
      refresh();
    }
  }

  function uninstall() {
    active = false;
    clearTimeout(previewTimer);
    previewTimer = null;
    // Só devolve o original se ninguém embrulhou por cima; senão o nosso
    // embrulho fica na cadeia, inerte (active = false).
    if (ThreadCard && ThreadCard.prototype.fillRow === wrappedFillRow) {
      ThreadCard.prototype.fillRow = originalFillRow;
    }
    if (wrappedDensityChange && threadPane.densityChange === wrappedDensityChange) {
      threadPane.densityChange = originalDensityChange;
    }
    if (ThreadCard) {
      for (const topic of AB_TOPICS) {
        try {
          Services.obs.removeObserver(abObserver, topic);
        } catch (e) {}
      }
    }
    for (const el of document.querySelectorAll(".unf-avatar, .unf-preview")) {
      el.remove();
    }
    for (const el of document.querySelectorAll(".sender.unf-suspicious")) {
      el.classList.remove("unf-suspicious");
    }
    resizeRows();
    refresh();
  }

  const decorator = {
    configure,
    uninstall() {
      uninstall();
      if (window.UnfoundSkinDecorator === decorator) {
        delete window.UnfoundSkinDecorator;
      }
    },
    isActive: () => active,
  };
  window.UnfoundSkinDecorator = decorator;
  install().catch(e => console.error("theUnfound Theme:", e));
})();
