/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Carregado pelo experimento theUnfound Theme dentro de cada documento about:message.
 *  - Dá ao avatar do remetente no cabeçalho a mesma cor e as mesmas iniciais
 *    usadas na lista de mensagens.
 *  - Aplica as regras de remetente (SenderTrust.sys.mjs): marca o remetente
 *    como conhecido/desconhecido/suspeito, põe o endereço completo na dica e,
 *    se suspeito, um selo de alerta com o motivo — inclusive quando o
 *    servidor reprovou a mensagem no DMARC/SPF (Authentication-Results,
 *    lido da cópia local da mensagem).
 * Desfeito em UnfoundSkinDecorator.uninstall().
 */

"use strict";

(function () {
  // O experimento remove qualquer decorador anterior antes de carregar este.
  if (window.UnfoundSkinDecorator) {
    return;
  }

  const KIND_CLASSES = ["unf-known", "unf-unknown", "unf-suspicious"];

  let observer = null;
  let enabled = true;
  let avatarsEnabled = true;
  let senderDisplay = "smart";
  let Trust = null;

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

  function decorateAvatar(recipient) {
    const avatar = recipient.querySelector(".recipient-avatar");
    if (!avatar) {
      return;
    }
    if (!enabled || !avatarsEnabled) {
      avatar.style.removeProperty("--unf-avatar-hue");
      return;
    }
    const email = recipient.emailAddress || "";
    const name = recipient.displayName || "";
    const key = (email || name || "?").toLowerCase();
    const hue = String(hueFor(key));
    if (avatar.style.getPropertyValue("--unf-avatar-hue") != hue) {
      avatar.style.setProperty("--unf-avatar-hue", hue);
    }
    const letters = avatar.querySelector(":scope > span");
    if (letters && !avatar.classList.contains("has-avatar")) {
      const initials = initialsFor(name, email);
      if (letters.textContent != initials) {
        letters.textContent = initials;
      }
    }
  }

  function clearTrust(recipient) {
    recipient.classList.remove(...KIND_CLASSES);
    recipient.querySelector(":scope > .unf-sender-badge")?.remove();
    if (recipient.dataset.unfTitle) {
      recipient.removeAttribute("title");
    }
    delete recipient.dataset.unfTitle;
    delete recipient.dataset.unfTrust;
  }

  function decorateTrust(recipient, authFailure) {
    if (!enabled || !Trust || !recipient.emailAddress) {
      clearTrust(recipient);
      return;
    }
    const info = Trust.classify({
      name: recipient.displayName || "",
      email: recipient.emailAddress,
    });
    const reasons = info.kind == "suspicious" ? [...info.reasons] : [];
    if (authFailure) {
      reasons.push(authFailure);
    }
    const kind = reasons.length ? "suspicious" : info.kind;
    const alert = reasons.length > 0 && senderDisplay != "name";
    const title = alert
      ? `⚠ Atenção:\n${reasons.map(r => `• ${r}`).join("\n")}\n\n${info.fullAddress}`
      : info.fullAddress;

    // Idempotente: o MutationObserver também vê as mudanças feitas aqui.
    const signature = `${senderDisplay}|${kind}|${alert}|${title}`;
    if (recipient.dataset.unfTrust == signature) {
      return;
    }
    clearTrust(recipient);
    recipient.dataset.unfTrust = signature;
    recipient.classList.add(`unf-${kind}`);
    recipient.title = title;
    recipient.dataset.unfTitle = "true";

    if (alert) {
      const badge = document.createElement("span");
      badge.className = "unf-sender-badge";
      badge.textContent = "Suspeito";
      badge.title = title;
      const anchor = recipient.querySelector(":scope > .recipient-address-book-button");
      recipient.insertBefore(badge, anchor ?? null);
    }
  }

  // Authentication-Results da mensagem exibida (lido de forma assíncrona).
  const auth = { uri: null, value: null };

  function authenticationFailure() {
    const uri = window.gMessageURI;
    if (!Trust || !uri) {
      return null;
    }
    if (auth.uri != uri) {
      auth.uri = uri;
      auth.value = null;
      Trust.readAuthenticationResults(uri).then(value => {
        if (enabled && window.gMessageURI == uri && auth.uri == uri) {
          auth.value = value;
          if (value) {
            decorate();
          }
        }
      });
    }
    return auth.value ? Trust.authenticationFailure(auth.value) : null;
  }

  function decorate() {
    const box = document.getElementById("expandedfromBox");
    if (!box) {
      return;
    }
    let authFailure = null;
    try {
      authFailure = authenticationFailure();
    } catch (e) {
      console.error("theUnfound Theme:", e);
    }
    for (const recipient of box.querySelectorAll("li.header-recipient")) {
      decorateAvatar(recipient);
      decorateTrust(recipient, authFailure);
    }
  }

  function configure(options) {
    avatarsEnabled = options?.avatars !== false;
    if (["smart", "full", "name"].includes(options?.senderDisplay)) {
      senderDisplay = options.senderDisplay;
    }
    if (!Trust && options?.trustModuleURL) {
      try {
        Trust = ChromeUtils.importESModule(options.trustModuleURL);
      } catch (e) {
        console.error("theUnfound Theme:", e);
      }
    }
    decorate();
  }

  function uninstall() {
    observer?.disconnect();
    observer = null;
    enabled = false;
    decorate();
    // Redesenha o avatar original do Thunderbird (inicial única).
    for (const recipient of document.querySelectorAll(
      "#expandedfromBox li.header-recipient"
    )) {
      try {
        recipient._updateAvatar?.();
      } catch (e) {}
    }
  }

  const box = document.getElementById("expandedfromBox");
  if (box) {
    observer = new MutationObserver(decorate);
    observer.observe(box, { childList: true, subtree: true });
    decorate();
  }

  const decorator = {
    configure,
    uninstall() {
      uninstall();
      if (window.UnfoundSkinDecorator === decorator) {
        delete window.UnfoundSkinDecorator;
      }
    },
    isActive: () => enabled,
  };
  window.UnfoundSkinDecorator = decorator;
})();
