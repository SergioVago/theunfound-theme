// Cenário do "nome inteligente" no perfil de desenvolvimento: contatos no
// catálogo e mensagens de remetentes conhecidos, desconhecidos e suspeitos.
// Uso: python3 tools/tbctl.py exec --port 2850 --file tools/seed-senders.js
// Idempotente (pula contatos e mensagens que já existem).

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
const EMAIL = "daniel@exemplo.com.br";

const account = MailServices.accounts.accounts.find(
  a => a.defaultIdentity?.email == EMAIL
);
if (!account) {
  throw new Error("Rode antes tools/seed-profile.js");
}
const inbox = account.incomingServer.rootFolder.getFolderWithFlags(
  Ci.nsMsgFolderFlags.Inbox
);

// --- Contatos -------------------------------------------------------------

const personal = MailServices.ab.getDirectory("jsaddrbook://abook.sqlite");
const collected = MailServices.ab.getDirectory("jsaddrbook://history.sqlite");

function addContact(directory, displayName, email, first = "", last = "") {
  if (directory.cardForEmailAddress(email)) {
    return false;
  }
  const card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(
    Ci.nsIAbCard
  );
  card.displayName = displayName;
  card.firstName = first;
  card.lastName = last;
  card.primaryEmail = email;
  directory.addCard(card);
  return true;
}

const contacts = [
  addContact(personal, "Mariana Costa", "mariana.costa@empresa.exemplo.com.br", "Mariana", "Costa"),
  addContact(personal, "Rafael Souza", "rafael@empresa.exemplo.com.br", "Rafael", "Souza"),
  addContact(personal, "Juliana Martins", "juliana.martins@agencia.exemplo.com.br", "Juliana", "Martins"),
  addContact(personal, "Pedro Henrique", "pedro.henrique@correio.exemplo.com", "Pedro", "Henrique"),
  addContact(personal, "Ana Beatriz Lima", "ana.lima@correio.exemplo.com", "Ana Beatriz", "Lima"),
  // "Endereços coletados": pessoas a quem o Daniel já respondeu.
  addContact(collected, "Lucas Ferreira", "lucas.ferreira@cliente.exemplo.com.br"),
  addContact(collected, "Carla Mendes", "carla.mendes@correio.exemplo.com"),
].filter(Boolean).length;

// --- Mensagens ------------------------------------------------------------

const b64 = s => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
};
const hdr = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap = s => s.replace(/.{1,76}/g, "$&\r\n");
const now = Date.now();

function raw(m) {
  const from = m.name ? `${hdr(m.name)} <${m.email}>` : m.email;
  const lines = [
    ...(m.extraHeaders || []),
    `From: ${from}`,
    `To: Daniel Prado <${EMAIL}>`,
    `Subject: ${hdr(m.subject)}`,
    `Date: ${new Date(now - m.minutes * 60e3).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${m.id}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return lines.join("\r\n") + "\r\n\r\n" + wrap(b64(m.text.trim() + "\r\n"));
}

const MESSAGES = [
  {
    id: "senders-unknown-1@exemplo.com.br",
    minutes: 3,
    name: "Monitor Exemplo",
    email: "alertas@monitor.exemplo.com",
    subject: "⚠ backup-diario está DOWN",
    text: `O check "backup-diario" não recebeu ping nas últimas 26 horas.\n\nÚltimo ping: ontem, 02:00.`,
  },
  {
    id: "senders-unknown-2@exemplo.com.br",
    minutes: 6,
    name: "Reservas.exemplo.com",
    email: "noreply@mailer.reservas.exemplo.com",
    subject: "Sua reserva em Gramado está confirmada",
    text: `Obrigado por reservar com a Reservas.exemplo.com! Check-in: 14/11, check-out: 17/11.`,
  },
  {
    id: "senders-noname-1@exemplo.com.br",
    minutes: 9,
    name: "",
    email: "no-reply@status.fornecedor.exemplo.com",
    subject: "Manutenção programada no datacenter SP-2",
    text: `Haverá uma janela de manutenção no sábado, das 02:00 às 04:00.`,
  },
  {
    // (a) o nome traz outro endereço
    id: "senders-suspicious-a@exemplo.com.br",
    minutes: 12,
    name: "atendimento@banco.exemplo.com.br",
    email: "seguranca@banco-exemplo-atendimento.top",
    subject: "Sua conta será bloqueada em 24h",
    text: `Detectamos um acesso incomum. Confirme seus dados no link abaixo para evitar o bloqueio da sua conta.`,
  },
  {
    // (b) o nome cita um domínio que não é o do remetente
    id: "senders-suspicious-b@exemplo.com.br",
    minutes: 15,
    name: "Pagamentos.exemplo.com Segurança",
    email: "service@pagamentos-exemp1o.top",
    subject: "Pagamento de R$ 2.349,90 aguardando confirmação",
    text: `Recebemos uma solicitação de pagamento. Se não foi você, clique aqui para cancelar.`,
  },
  {
    // (c) mesmo nome de um contato conhecido, outro endereço
    id: "senders-suspicious-c@exemplo.com.br",
    minutes: 18,
    name: "Mariana Costa",
    email: "mariana.costa.empresa@correio.exemplo.com",
    subject: "Urgente: pagamento do fornecedor ainda hoje",
    text: `Daniel, estou numa reunião e não consigo falar. Preciso que você faça um Pix para o fornecedor ainda hoje. Te mando os dados.`,
  },
  {
    // (d) endereço de um contato conhecido, mas reprovado no DMARC/SPF
    id: "senders-suspicious-d@exemplo.com.br",
    minutes: 21,
    name: "Rafael Souza",
    email: "rafael@empresa.exemplo.com.br",
    subject: "Troca da conta bancária para os pagamentos",
    text: `Oi Daniel, mudamos de banco. A partir de agora os pagamentos devem ir para a nova conta abaixo.`,
    extraHeaders: [
      "Authentication-Results: mx.exemplo.invalid; dkim=none; spf=fail smtp.mailfrom=empresa.exemplo.com.br; dmarc=fail (p=reject) header.from=empresa.exemplo.com.br",
    ],
  },
  {
    // conhecido (catálogo pessoal)
    id: "senders-known-1@exemplo.com.br",
    minutes: 24,
    name: "Juliana Martins",
    email: "juliana.martins@agencia.exemplo.com.br",
    subject: "Re: Proposta comercial revisada",
    text: `Perfeito, Daniel! Fico no aguardo da assinatura.`,
  },
];

const local = inbox.QueryInterface(Ci.nsIMsgLocalMailFolder);
const db = inbox.msgDatabase;
const missing = MESSAGES.filter(m => !db.getMsgHdrForMessageID(m.id));
if (missing.length) {
  local.addMessageBatch(missing.map(raw));
  const added = missing
    .map(m => inbox.msgDatabase.getMsgHdrForMessageID(m.id))
    .filter(Boolean);
  inbox.markMessagesRead(added, false);
}
return { ok: true, contacts, messages: missing.length };
