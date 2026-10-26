// Contas extras para exercitar o trilho de contas (painel recolhido): várias
// contas POP fictícias (sem rede) com Entradas de 0, poucas e mais de 99 não
// lidas, uma conta de feeds (sem Entrada, fica fora do trilho) e um contato no
// catálogo com foto para o e-mail de uma das contas.
// Uso: python3 tools/tbctl.py exec --port 2860 --file tools/seed-accounts.js
// Rode depois de tools/seed-profile.js. Idempotente.

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
const { VCardUtils } = ChromeUtils.importESModule(
  "resource:///modules/VCardUtils.sys.mjs"
);
const F = Ci.nsMsgFolderFlags;

const ACCOUNTS = [
  { user: "daniel.empresa", host: "pop.empresa.exemplo.invalid", name: "Trabalho", fullName: "Daniel Prado", email: "daniel@empresa.exemplo.com.br", unread: 4, read: 6 },
  { user: "daniel.pessoal", host: "pop.correio.exemplo.invalid", name: "Pessoal", fullName: "Daniel Prado", email: "daniel.prado@correio.exemplo.com", unread: 0, read: 8 },
  { user: "daniel.banda", host: "pop.banda.exemplo.invalid", name: "Banda Exemplo", fullName: "Daniel Prado", email: "daniel@banda.exemplo.com.br", unread: 123, read: 3 },
  { user: "financeiro", host: "pop.estudio.exemplo.invalid", name: "Financeiro", fullName: "Daniel Prado", email: "financeiro@estudio.exemplo.com.br", unread: 7, read: 2 },
];

const SENDERS = [
  ["Mariana Costa", "mariana.costa@empresa.exemplo.com.br"],
  ["Pedro Henrique", "pedro.henrique@correio.exemplo.com"],
  ["Banco Exemplo", "atendimento@banco.exemplo.com.br"],
  ["Ana Beatriz Lima", "ana.lima@correio.exemplo.com"],
  ["Repositórios Exemplo", "avisos@repositorios.exemplo.com"],
  ["Hospedagem Exemplo", "cobranca@hospedagem.exemplo.com"],
  ["Streaming Exemplo", "no-reply@streaming.exemplo.com"],
];
const SUBJECTS = [
  "Ensaio de quinta confirmado",
  "Boleto disponível",
  "Repertório novo para o show",
  "Atualização do projeto",
  "Fotos do último show",
  "Lembrete de pagamento",
  "Convite para o festival",
  "Resumo da semana",
];

const b64 = s => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
};
const hdr = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function message(spec, i, to) {
  const [name, email] = SENDERS[i % SENDERS.length];
  const subject = `${SUBJECTS[i % SUBJECTS.length]} #${i + 1}`;
  const date = new Date(Date.now() - (i + 1) * 47 * 60e3).toUTCString().replace("GMT", "+0000");
  const id = `rail-${spec.user}-${i}@exemplo.invalid`;
  const text = `Mensagem de exemplo ${i + 1} para ${spec.name}.\r\n`;
  const raw = [
    `From: ${hdr(name)} <${email}>`,
    `To: ${hdr(to.fullName)} <${to.email}>`,
    `Subject: ${hdr(subject)}`,
    `Date: ${date}`,
    `Message-ID: <${id}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    "",
  ].join("\r\n");
  return { id, raw };
}

function folder(root, name, flag) {
  let f = root.getFolderWithFlags(flag) || root.getChildNamed(name);
  if (!f) {
    root.createSubfolder(name, null);
    f = root.getChildNamed(name);
  }
  f.setFlag(flag);
  return f;
}

const created = [];
for (const spec of ACCOUNTS) {
  if (MailServices.accounts.accounts.some(a => a.defaultIdentity?.email == spec.email)) {
    continue;
  }
  const server = MailServices.accounts.createIncomingServer(spec.user, spec.host, "pop3");
  server.prettyName = spec.name;
  server.loginAtStartUp = false;
  server.doBiff = false;
  const identity = MailServices.accounts.createIdentity();
  identity.fullName = spec.fullName;
  identity.email = spec.email;
  const account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  account.addIdentity(identity);

  const root = server.rootFolder;
  const inbox = folder(root, "Inbox", F.Inbox);
  folder(root, "Sent", F.SentMail);
  folder(root, "Trash", F.Trash);

  const total = spec.unread + spec.read;
  const built = Array.from({ length: total }, (_, i) => message(spec, i, spec));
  inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessageBatch(built.map(b => b.raw));
  const db = inbox.msgDatabase;
  const hdrs = built.map(b => db.getMsgHdrForMessageID(b.id)).filter(Boolean);
  const unread = hdrs.slice(0, spec.unread);
  const read = hdrs.slice(spec.unread);
  if (read.length) {
    inbox.markMessagesRead(read, true);
  }
  if (unread.length) {
    inbox.markMessagesRead(unread, false);
  }
  created.push(spec.name);
}

// Conta de feeds: sem identidade nem Entrada (não aparece no trilho).
let feeds = false;
if (!MailServices.accounts.accounts.some(a => a.incomingServer?.type == "rss")) {
  const server = MailServices.accounts.createIncomingServer("nobody", "Feeds", "rss");
  server.prettyName = "Blogs e notícias";
  const account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  feeds = true;
}

// Foto no catálogo para a conta "Pessoal" (fallback 2 do trilho).
function photo(colors, skin) {
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(64, 52, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(64, 124, 44, 38, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#3b2a20";
  ctx.beginPath();
  ctx.arc(64, 44, 25, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  return canvas.toDataURL("image/png");
}

const personal = MailServices.ab.getDirectory("jsaddrbook://abook.sqlite");
const PHOTO_EMAIL = "daniel.prado@correio.exemplo.com";
let photoCard = false;
if (!personal.cardForEmailAddress(PHOTO_EMAIL)) {
  const card = VCardUtils.vCardToAbCard(
    [
      "BEGIN:VCARD",
      "VERSION:4.0",
      "FN:Daniel Prado",
      "N:Prado;Daniel;;;",
      `EMAIL;PREF=1:${PHOTO_EMAIL}`,
      `PHOTO:${photo(["#2dd4bf", "#0369a1"], "#f2c6a0")}`,
      "END:VCARD",
    ].join("\r\n")
  );
  personal.addCard(card);
  photoCard = true;
}

MailServices.accounts.saveAccountInfo?.();
Services.prefs.savePrefFile(null);

return {
  ok: true,
  created,
  feeds,
  photoCard,
  accounts: MailServices.accounts.accounts.map(a => {
    const inbox = a.incomingServer?.rootMsgFolder?.getFolderWithFlags(F.Inbox);
    return {
      key: a.key,
      type: a.incomingServer?.type,
      name: a.incomingServer?.prettyName,
      email: a.defaultIdentity?.email ?? null,
      unread: inbox ? inbox.getNumUnread(false) : null,
    };
  }),
};
