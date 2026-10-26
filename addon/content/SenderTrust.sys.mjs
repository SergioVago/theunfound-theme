/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * "Nome inteligente": decide como mostrar cada remetente/destinatário.
 *
 *  - conhecido (endereço em algum catálogo de endereços — inclusive
 *    "Endereços coletados" — ou uma identidade do próprio usuário):
 *    só o nome (o do catálogo, que não vem do e-mail);
 *  - desconhecido: nome + domínio registrável, discreto;
 *  - suspeito: endereço completo + alerta, com o motivo na dica.
 *
 * Módulo compartilhado pelas janelas (about:3pane e about:message): um só
 * cache por endereço, limpo quando o catálogo muda. Não guarda referências a
 * nenhuma janela.
 */

import { MailServices } from "resource:///modules/MailServices.sys.mjs";

const AB_TOPICS = [
  "addrbook-contact-created",
  "addrbook-contact-updated",
  "addrbook-contact-deleted",
  "addrbook-directory-created",
  "addrbook-directory-deleted",
  "addrbook-reloaded",
  "addrbook-displayname-changed",
];

// Provedores de e-mail gratuitos: dois endereços no mesmo domínio não dizem
// nada sobre serem a mesma pessoa/organização.
const FREEMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.com.br",
  "hotmail.com",
  "hotmail.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "r7.com",
  "tutanota.com",
  "fastmail.com",
]);

const EMAIL_IN_TEXT = /[\p{L}\p{N}._%+'-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const DOMAIN_IN_TEXT =
  /(?<![\p{L}\p{N}@.-])((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}][\p{L}\p{N}-]{1,62})(?![\p{L}\p{N}-]|\.[\p{L}\p{N}])/gu;

const idnService = Cc["@mozilla.org/network/idn-service;1"].getService(
  Ci.nsIIDNService
);

const state = {
  authResults: new Map(),
  results: new Map(),
  names: null,
  identities: null,
  observing: false,
};

const observer = {
  observe() {
    invalidate();
  },
};

function ensureObserving() {
  if (state.observing) {
    return;
  }
  state.observing = true;
  for (const topic of AB_TOPICS) {
    Services.obs.addObserver(observer, topic);
  }
}

export function invalidate() {
  state.results.clear();
  state.authResults.clear();
  state.names = null;
  state.identities = null;
}

/** Libera caches e observadores (chamado ao desligar o addon). */
export function reset() {
  invalidate();
  if (state.observing) {
    for (const topic of AB_TOPICS) {
      try {
        Services.obs.removeObserver(observer, topic);
      } catch (e) {}
    }
    state.observing = false;
  }
}

export function normalizeName(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/["'“”‘’«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toAscii(host) {
  try {
    return idnService.convertUTF8toACE(host);
  } catch (e) {
    return host;
  }
}

export function hostOf(email) {
  const at = (email || "").lastIndexOf("@");
  return at == -1 ? "" : email.slice(at + 1).toLowerCase().replace(/\.$/, "");
}

/** Domínio registrável (eTLD+1), ex. "mail.exemplo.com.br" → "exemplo.com.br". */
export function registrableDomain(host) {
  if (!host) {
    return "";
  }
  const ascii = toAscii(host.toLowerCase());
  try {
    const base = Services.eTLD.getBaseDomainFromHost(ascii);
    // Mostra a forma legível (sem punycode) se o host original era Unicode.
    return ascii == host ? base : idnService.convertToDisplayIDN(base);
  } catch (e) {
    return host.toLowerCase();
  }
}

function hasKnownSuffix(host) {
  try {
    return !!Services.eTLD.getKnownPublicSuffixFromHost(toAscii(host));
  } catch (e) {
    return false;
  }
}

export function parseAddresses(header) {
  if (!header) {
    return [];
  }
  try {
    return MailServices.headerParser.parseDecodedHeader(header).map(a => ({
      name: (a.name || "").trim(),
      email: (a.email || "").trim(),
    }));
  } catch (e) {
    return [];
  }
}

function identities() {
  if (!state.identities) {
    state.identities = new Map();
    for (const identity of MailServices.accounts.allIdentities) {
      if (identity.email) {
        state.identities.set(identity.email.toLowerCase(), identity);
      }
    }
  }
  return state.identities;
}

/**
 * Índice nome normalizado → endereços dos contatos com esse nome (todos os
 * catálogos locais, inclusive "Endereços coletados", e as identidades).
 */
function nameIndex() {
  if (state.names) {
    return state.names;
  }
  const index = new Map();
  const add = (name, email) => {
    const key = normalizeName(name);
    if (key.length < 3 || !/\p{L}/u.test(key) || !email) {
      return;
    }
    const address = email.trim().toLowerCase();
    let list = index.get(key);
    if (!list) {
      list = [];
      index.set(key, list);
    }
    if (!list.some(entry => entry.email == address)) {
      list.push({ email: address, domain: registrableDomain(hostOf(address)) });
    }
  };
  for (const directory of MailServices.ab.directories) {
    if (directory.isRemote) {
      continue;
    }
    let cards = [];
    try {
      cards = directory.childCards;
    } catch (e) {
      continue;
    }
    for (const card of cards) {
      if (card.isMailList) {
        continue;
      }
      let emails = [];
      try {
        emails = card.emailAddresses;
      } catch (e) {
        emails = [card.primaryEmail];
      }
      const full = [card.firstName, card.lastName].filter(Boolean).join(" ");
      for (const name of new Set([card.displayName, full])) {
        for (const email of emails) {
          add(name, email);
        }
      }
    }
  }
  for (const identity of MailServices.accounts.allIdentities) {
    add(identity.fullName, identity.email);
  }
  state.names = index;
  return index;
}

function suspiciousReasons(name, email, domain) {
  const reasons = [];
  if (!name) {
    return reasons;
  }

  // (a) O nome traz outro endereço de e-mail.
  const emailsInName = name.match(EMAIL_IN_TEXT) || [];
  for (const other of emailsInName) {
    if (other.toLowerCase() != email) {
      reasons.push(
        `O nome exibido contém outro endereço (${other}), diferente do endereço real.`
      );
      break;
    }
  }

  // (b) O nome cita um domínio que não é o do remetente.
  const withoutEmails = name.replace(EMAIL_IN_TEXT, " ");
  for (const match of withoutEmails.matchAll(DOMAIN_IN_TEXT)) {
    const token = match[1].toLowerCase();
    if (!hasKnownSuffix(token)) {
      continue;
    }
    const cited = registrableDomain(token);
    if (cited && cited != domain) {
      reasons.push(
        `O nome cita o domínio “${token}”, mas a mensagem vem de “${domain}”.`
      );
      break;
    }
  }

  // (c) Mesmo nome de um contato conhecido, mas de outro endereço.
  const lookalikes = nameIndex().get(normalizeName(name));
  if (lookalikes?.length) {
    const sameOrganization =
      !FREEMAIL.has(domain) && lookalikes.some(entry => entry.domain == domain);
    if (!sameOrganization) {
      reasons.push(
        `Mesmo nome de um contato seu (${lookalikes[0].email}), mas enviado de outro endereço.`
      );
    }
  }
  return reasons;
}

/**
 * Classifica um endereço.
 *
 * @param {{name: string, email: string}} person
 * @returns {{kind: "known"|"unknown"|"suspicious"|"none", name: string,
 *   email: string, domain: string, displayName: string, reasons: string[],
 *   fullAddress: string}}
 */
export function classify(person) {
  ensureObserving();
  const name = (person?.name || "").trim();
  const email = (person?.email || "").trim().toLowerCase();
  if (!email) {
    return {
      kind: "none",
      name,
      email: "",
      domain: "",
      displayName: name,
      reasons: [],
      fullAddress: name,
    };
  }
  const key = `${email}\n${name}`;
  const cached = state.results.get(key);
  if (cached) {
    return cached;
  }

  const domain = registrableDomain(hostOf(email));
  const result = {
    kind: "unknown",
    name,
    email,
    domain,
    displayName: name,
    reasons: [],
    fullAddress: name ? `${name} <${email}>` : email,
  };

  const identity = identities().get(email);
  let card = null;
  try {
    card = MailServices.ab.cardForEmailAddress(email);
  } catch (e) {}

  if (identity || card) {
    result.kind = "known";
    result.displayName =
      card?.displayName ||
      [card?.firstName, card?.lastName].filter(Boolean).join(" ") ||
      identity?.fullName ||
      name;
  } else {
    result.reasons = suspiciousReasons(name, email, domain);
    if (result.reasons.length) {
      result.kind = "suspicious";
    }
  }

  if (state.results.size > 5000) {
    state.results.clear();
  }
  state.results.set(key, result);
  return result;
}

/**
 * Monta o texto a exibir para uma lista de pessoas, como segmentos que cada
 * janela transforma em elementos.
 *
 * @param {Array<{name: string, email: string}>} people
 * @param {"smart"|"full"|"name"} mode
 * @returns {{segments: Array<{type: string, text: string}>, title: string,
 *   suspicious: boolean, reasons: string[]}}
 */
export function describe(people, mode = "smart") {
  const segments = [];
  const titleLines = [];
  const reasons = [];
  people.forEach((person, i) => {
    const info = classify(person);
    if (i > 0) {
      segments.push({ type: "separator", text: ", " });
    }
    titleLines.push(info.fullAddress);
    const label = info.displayName || info.email;

    if (info.kind == "none") {
      segments.push({ type: "name", text: info.name });
      return;
    }
    if (mode == "name") {
      segments.push({ type: "name", text: label });
      return;
    }
    if (mode == "full") {
      const flagged = info.kind == "suspicious";
      if (flagged) {
        segments.push({ type: "alert", text: "" });
        reasons.push(...info.reasons);
      }
      const addressType = flagged ? "suspicious-address" : "address";
      if (info.displayName) {
        segments.push({ type: "name", text: info.displayName });
        segments.push({ type: addressType, text: `<${info.email}>` });
      } else {
        segments.push({ type: addressType, text: info.email });
      }
      return;
    }
    // Nome inteligente.
    if (info.kind == "known") {
      segments.push({ type: "name", text: label });
    } else if (info.kind == "unknown") {
      if (info.name) {
        segments.push({ type: "name", text: info.name });
        if (info.domain) {
          segments.push({ type: "domain", text: info.domain });
        }
      } else {
        segments.push({ type: "name", text: info.email });
      }
    } else {
      // Suspeito: o endereço real vem primeiro (é ele que importa, e assim
      // não é o que some quando a coluna é estreita); o nome alegado depois.
      segments.push({ type: "alert", text: "" });
      segments.push({ type: "suspicious-address", text: info.email });
      if (info.name) {
        segments.push({ type: "claimed-name", text: info.name });
      }
      reasons.push(...info.reasons);
    }
  });

  let title = titleLines.join("\n");
  if (reasons.length) {
    title = `⚠ Atenção:\n${reasons.map(r => `• ${r}`).join("\n")}\n\n${title}`;
  }
  return {
    segments,
    title,
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Lê o resultado de autenticação (DMARC/SPF) do cabeçalho
 * Authentication-Results mais recente — o acrescentado pelo último servidor,
 * normalmente o seu. Só falhas viram alerta: um "pass" forjado mais abaixo não
 * muda nada, e um "fail" só prejudicaria quem o forjou.
 *
 * @param {string} value - Valor do primeiro Authentication-Results.
 * @returns {string|null} Motivo do alerta ou null.
 */
export function authenticationFailure(value) {
  if (!value) {
    return null;
  }
  const failed = [];
  if (/\bdmarc\s*=\s*fail\b/i.test(value)) {
    failed.push("DMARC");
  }
  if (/\bspf\s*=\s*fail\b/i.test(value)) {
    failed.push("SPF");
  }
  if (!failed.length) {
    return null;
  }
  const verb = failed.length > 1 ? "falharam" : "falhou";
  return `O servidor de e-mail não confirmou a origem desta mensagem (${failed.join(
    " e "
  )} ${verb}): o remetente pode ter sido falsificado.`;
}

/**
 * Lê (só da cópia local, sem rede) o primeiro cabeçalho
 * Authentication-Results de uma mensagem. O Thunderbird não guarda esse
 * cabeçalho no banco nem o entrega ao painel de leitura, por isso ele é lido
 * direto da mensagem. Resultado em cache por URI.
 *
 * @param {string} messageURI
 * @returns {Promise<string|null>}
 */
export function readAuthenticationResults(messageURI) {
  if (!messageURI) {
    return Promise.resolve(null);
  }
  const cached = state.authResults.get(messageURI);
  if (cached) {
    return cached;
  }
  const promise = new Promise(resolve => {
    let buffer = "";
    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIStreamListener",
        "nsIRequestObserver",
      ]),
      onStartRequest() {},
      onDataAvailable(request, stream, offset, count) {
        const input = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
          Ci.nsIScriptableInputStream
        );
        input.init(stream);
        buffer += input.readBytes(count);
      },
      onStopRequest() {
        const unfolded = buffer.split(/\r?\n(?![ \t])/);
        const line = unfolded.find(l => /^authentication-results\s*:/i.test(l));
        resolve(
          line ? line.replace(/^[^:]*:/, "").replace(/\s+/g, " ").trim() : null
        );
      },
    };
    try {
      MailServices.messageServiceFromURI(messageURI).streamHeaders(
        messageURI,
        listener,
        null,
        true
      );
    } catch (e) {
      resolve(null);
    }
  });
  if (state.authResults.size > 200) {
    state.authResults.clear();
  }
  state.authResults.set(messageURI, promise);
  return promise;
}
