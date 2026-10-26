// Popula um perfil de desenvolvimento com uma conta fictícia e mensagens de
// exemplo em português, para os screenshots do addon.
// Uso: python3 tools/tbctl.py exec --port 2850 --file tools/seed-profile.js
// Idempotente: se a conta de exemplo já existir, não faz nada.

const EMAIL = "daniel@exemplo.com.br";
const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
const F = Ci.nsMsgFolderFlags;

if (MailServices.accounts.accounts.some(a => a.defaultIdentity?.email == EMAIL)) {
  return { ok: true, skipped: true };
}

let hasLocal = false;
try {
  hasLocal = !!MailServices.accounts.localFoldersServer;
} catch (e) {}
if (!hasLocal) {
  MailServices.accounts.createLocalMailAccount();
}

const server = MailServices.accounts.createIncomingServer(
  "daniel",
  "pop.exemplo.invalid",
  "pop3"
);
server.prettyName = EMAIL;
server.loginAtStartUp = false;
server.doBiff = false;
const identity = MailServices.accounts.createIdentity();
identity.fullName = "Daniel Prado";
identity.email = EMAIL;
const account = MailServices.accounts.createAccount();
account.incomingServer = server;
account.addIdentity(identity);
MailServices.accounts.defaultAccount = account;

const root = server.rootFolder;
function folder(name, flag) {
  let f = flag ? root.getFolderWithFlags(flag) : null;
  if (!f) {
    f = root.getChildNamed(name);
  }
  if (!f) {
    root.createSubfolder(name, null);
    f = root.getChildNamed(name);
  }
  if (flag) {
    f.setFlag(flag);
  }
  return f;
}
const inbox = folder("Inbox", F.Inbox);
const sent = folder("Sent", F.SentMail);
const drafts = folder("Drafts", F.Drafts);
folder("Templates", F.Templates);
const archives = folder("Archives", F.Archive);
folder("Junk", F.Junk);
folder("Trash", F.Trash);
const projetos = folder("Projetos");
folder("Financeiro");
folder("Música");

const b64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
};
const hdr = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const addr = (name, email) => (name ? `${hdr(name)} <${email}>` : email);
const wrap = s => s.replace(/.{1,76}/g, "$&\r\n");

const now = Date.now();
const H = 3600e3;
let seq = 0;

function build(m) {
  const id = m.id || `seed-${++seq}@exemplo.com.br`;
  const date = new Date(now - m.ago * H).toUTCString().replace("GMT", "+0000");
  const head = [
    `From: ${addr(m.from[0], m.from[1])}`,
    `To: ${m.to ? addr(m.to[0], m.to[1]) : addr("Daniel Prado", EMAIL)}`,
    `Subject: ${hdr(m.subject)}`,
    `Date: ${date}`,
    `Message-ID: <${id}>`,
    "MIME-Version: 1.0",
  ];
  if (m.refs) {
    head.push(`In-Reply-To: <${m.refs.at(-1)}>`);
    head.push(`References: ${m.refs.map(r => `<${r}>`).join(" ")}`);
  }
  const text = m.text.trim() + "\r\n";
  const textPart = [
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(text)),
  ].join("\r\n");
  let body;
  if (!m.html && !m.attachment) {
    head.push(...textPart.split("\r\n").slice(0, 2));
    body = wrap(b64(text));
  } else {
    let alt = textPart;
    if (m.html) {
      const htmlPart = [
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrap(b64(m.html)),
      ].join("\r\n");
      alt = [
        "Content-Type: multipart/alternative; boundary=alt",
        "",
        "--alt",
        textPart,
        "--alt",
        htmlPart,
        "--alt--",
        "",
      ].join("\r\n");
    }
    if (m.attachment) {
      head.push("Content-Type: multipart/mixed; boundary=mix");
      body = [
        "--mix",
        alt,
        "--mix",
        `Content-Type: application/pdf; name="${m.attachment}"`,
        `Content-Disposition: attachment; filename="${m.attachment}"`,
        "Content-Transfer-Encoding: base64",
        "",
        wrap(b64("%PDF-1.4\n% exemplo\n%%EOF\n")),
        "--mix--",
        "",
      ].join("\r\n");
    } else {
      const [ctype, , ...rest] = alt.split("\r\n");
      head.push(ctype);
      body = rest.join("\r\n");
    }
  }
  return { id, raw: head.join("\r\n") + "\r\n\r\n" + body };
}

const news = (title, paras) => `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#ffcf33;padding:20px 28px;font-size:22px;font-weight:bold;color:#222">${title}</td></tr>
${paras.map(p => `<tr><td style="padding:14px 28px;font-size:15px;line-height:1.55;color:#333">${p}</td></tr>`).join("")}
<tr><td style="padding:18px 28px;font-size:12px;color:#888">Você recebeu este e-mail porque assinou a newsletter. Cancelar inscrição.</td></tr>
</table></td></tr></table></body></html>`;

const T1 = "seed-thread-1@exemplo.com.br";
const T2 = "seed-thread-2@exemplo.com.br";
const T3 = "seed-thread-3@exemplo.com.br";

const INBOX = [
  { ago: 0.3, from: ["Mariana Costa", "mariana.costa@empresa.exemplo.com.br"], subject: "Reunião de alinhamento — painel de estoque", id: T1, unread: true,
    text: `Oi, Daniel!\n\nPodemos fazer o alinhamento da nova versão do painel amanhã às 10h? Queria revisar com você o fluxo de cadastro dos equipamentos e o relatório mensal antes de mostrar para o cliente.\n\nSe preferir outro horário, me avisa.\n\nAbraços,\nMariana` },
  { ago: 0.2, from: ["Daniel Prado", EMAIL], to: ["Mariana Costa", "mariana.costa@empresa.exemplo.com.br"], subject: "Re: Reunião de alinhamento — painel de estoque", id: T2, refs: [T1],
    text: `Fechado, Mariana. Amanhã às 10h funciona para mim. Vou deixar o ambiente de homologação atualizado até lá.\n\nDaniel` },
  { ago: 0.1, from: ["Rafael Souza", "rafael@empresa.exemplo.com.br"], subject: "Re: Reunião de alinhamento — painel de estoque", id: T3, refs: [T1, T2], unread: true,
    text: `Posso entrar também? Tenho alguns pontos sobre a API de relatórios e o deploy no servidor de homologação.\n\nRafael` },
  { ago: 0.8, from: ["Repositórios Exemplo", "avisos@repositorios.exemplo.com"], subject: "[exemplo/tema-grafite] feat: barra lateral escura e trilho de contas (PR #12)", unread: true,
    text: `@rafael-souza aprovou estas alterações.\n\nFicou ótimo! Só um detalhe: o modo escuro precisa de um contraste maior na lista de mensagens.\n\n—\nResponda diretamente a este e-mail ou veja no repositório.` },
  { ago: 1.5, from: ["Resumo Diário", "contato@resumodiario.exemplo.com.br"], subject: "☕ Bom dia! O que você precisa saber hoje", unread: true,
    text: `Bom dia! Hoje: juros, tecnologia, futebol e a previsão do tempo para o feriado.`,
    html: news("☕ resumo diário", ["<b>Bom dia!</b> Aqui está o resumo do que importa hoje, em 5 minutos de leitura.", "<b>Economia:</b> o mercado reage às novas projeções de inflação para o próximo trimestre.", "<b>Tecnologia:</b> clientes de e-mail abertos ganham recursos de IA local e novas interfaces."]) },
  { ago: 2.4, from: ["Deploy Exemplo", "no-reply@deploy.exemplo.com"], subject: "✅ Deploy concluído: api-estoque",
    text: `O deploy da aplicação api-estoque foi concluído com sucesso.\n\nCommit: 3f9c2a1 — fix: corrige cálculo do estoque mínimo\nDuração: 1m 42s\nAmbiente: produção` },
  { ago: 3.1, from: ["Juliana Martins", "juliana.martins@agencia.exemplo.com.br"], subject: "Proposta comercial revisada", unread: true, flagged: true, attachment: "Proposta-Agencia-v3.pdf",
    text: `Olá Daniel,\n\nSegue em anexo a proposta revisada com o novo escopo (site institucional + painel administrativo). Ajustei o cronograma para 8 semanas, conforme conversamos.\n\nFico no aguardo do seu retorno.\n\nAtenciosamente,\nJuliana Martins\nAgência Exemplo` },
  { ago: 5, from: ["Banco Exemplo", "atendimento@banco.exemplo.com.br"], subject: "Sua fatura fechou: R$ 1.284,37",
    text: `Olá, Daniel. A fatura do seu cartão fechou hoje no valor de R$ 1.284,37, com vencimento em 28/10. Você pode pagar pelo app ou gerar um boleto.` },
  { ago: 7, from: ["Pedro Henrique", "pedro.henrique@correio.exemplo.com"], subject: "Show sábado no Bar do Zé 🥁",
    text: `E aí, Daniel!\n\nConfirmado o show de sábado. Passagem de som às 19h, a gente começa às 21h30. Leva as baquetas extras porque na última você quebrou duas, haha.\n\nSetlist igual à do mês passado, mas entra o samba novo no bis.\n\nAbraço,\nPedro` },
  { ago: 9, from: ["Registro de Domínios Exemplo", "noreply@dns.exemplo.com"], subject: "Seu domínio foi verificado com sucesso",
    text: `O domínio estoque.empresa.exemplo.com.br agora está ativo no painel de DNS. As alterações podem levar alguns minutos para se propagar.` },
  { ago: 20, from: ["Agenda Exemplo", "convites@agenda.exemplo.com"], subject: "Convite: Daily da equipe — seg. a sex., 09:30",
    text: `Você foi convidado para o evento Daily da equipe.\n\nQuando: segunda a sexta, 09:30 – 09:45 (BRT)\nOnde: sala virtual da equipe\nOrganizador: mariana.costa@empresa.exemplo.com.br` },
  { ago: 22, from: ["Lucas Ferreira", "lucas.ferreira@cliente.exemplo.com.br"], subject: "Dúvida sobre a API de estoque",
    text: `Oi Daniel, tudo bem?\n\nEstamos integrando o app de campo e surgiu uma dúvida: o endpoint /equipamentos/{id}/historico aceita paginação por cursor ou só por página? Precisamos puxar uns 2 anos de leituras.\n\nValeu!\nLucas` },
  { ago: 26, from: ["Hospedagem Exemplo", "cobranca@hospedagem.exemplo.com"], subject: "Lembrete: renovação da VPS em 7 dias",
    text: `Seu plano VPS 2 será renovado automaticamente em 7 dias. Verifique se o método de pagamento está atualizado para evitar interrupções.` },
  { ago: 30, from: ["Ana Beatriz Lima", "ana.lima@correio.exemplo.com"], subject: "Fotos do fim de semana 📸", flagged: true,
    text: `Oi! Separei as melhores fotos da viagem para a serra. Ficaram lindas as do pôr do sol. Quando puder, me manda as que você tirou com a câmera.\n\nBeijos,\nBia` },
  { ago: 34, from: ["Delivery Exemplo", "pedidos@delivery.exemplo.com.br"], subject: "Seu pedido foi entregue! Avalie sua experiência",
    text: `Seu pedido da Pizzaria do Bairro foi entregue. Conta pra gente como foi: sua avaliação ajuda outros clientes.` },
  { ago: 48, from: ["Boletim de Software Livre", "boletim@software.example.org"], subject: "Novidades do mês: o que mudou nos clientes de e-mail livres",
    text: `Conheça as novidades do mês: visualização em cartões aprimorada, melhorias no calendário e mais desempenho.`,
    html: news("Software Livre", ["<b>Visualização em cartões</b> agora com mais opções de densidade.", "<b>Calendário:</b> novo diálogo de eventos, mais simples e rápido.", "Obrigado por apoiar o software livre! Doe e ajude a manter o projeto independente."]) },
  { ago: 52, from: ["Transportadora Exemplo", "rastreamento@transportadora.exemplo.com.br"], subject: "Seu objeto está a caminho — EX123456789BR",
    text: `Objeto EX123456789BR: em trânsito para a unidade de distribuição em São Paulo/SP. Previsão de entrega: 2 dias úteis.` },
  { ago: 70, from: ["Carla Mendes", "carla.mendes@correio.exemplo.com"], subject: "Aniversário da mãe — presente coletivo",
    text: `Gente, para o aniversário da mãe pensei em darmos aquela cafeteira que ela comentou. Fica uns R$ 120 para cada. Topam? Preciso confirmar até sexta.\n\nCarla` },
  { ago: 75, from: ["Rede Profissional Exemplo", "avisos@rede.exemplo.com"], subject: "Você apareceu em 14 pesquisas esta semana",
    text: `Seu perfil está chamando atenção! Veja quem está pesquisando por você e quais palavras-chave levaram até seu perfil.` },
  { ago: 96, from: ["Carteira Digital Exemplo", "naoresponda@carteira.exemplo.com.br"], subject: "Comprovante de Pix enviado",
    text: `Pix de R$ 350,00 enviado para PEDRO HENRIQUE S. em 17/10 às 18:42. ID da transação: E00416968202610172142.` },
  { ago: 120, from: ["Streaming Exemplo", "no-reply@streaming.exemplo.com"], subject: "Sua mixagem da semana chegou 🎶",
    text: `Novas músicas escolhidas para você: jazz brasileiro, bossa nova e um pouco de rock dos anos 80.` },
  { ago: 150, from: ["Notas da Equipe", "avisos@notas.exemplo.com"], subject: "Resumo semanal: 8 atualizações no espaço da equipe",
    text: `Mariana Costa editou "Roadmap Q4". Rafael Souza comentou em "Arquitetura da API". 6 outras atualizações.` },
];

const SENT = [
  { ago: 0.2, from: ["Daniel Prado", EMAIL], to: ["Mariana Costa", "mariana.costa@empresa.exemplo.com.br"], subject: "Re: Reunião de alinhamento — painel de estoque", refs: [T1],
    text: `Fechado, Mariana. Amanhã às 10h funciona para mim.\n\nDaniel` },
  { ago: 23, from: ["Daniel Prado", EMAIL], to: ["Lucas Ferreira", "lucas.ferreira@cliente.exemplo.com.br"], subject: "Re: Dúvida sobre a API de estoque",
    text: `Oi Lucas! Aceita cursor sim: use o parâmetro ?cursor= retornado em cada página.\n\nDaniel` },
];

const ARCHIVE = [
  { ago: 400, from: ["Rafael Souza", "rafael@empresa.exemplo.com.br"], subject: "Checklist de produção", text: `Segue o checklist que usamos no último go-live.` },
];

const PROJETOS = [
  { ago: 200, from: ["Mariana Costa", "mariana.costa@empresa.exemplo.com.br"], subject: "Escopo da fase 2", text: `Anexei o documento de escopo da fase 2 no espaço da equipe.` },
];

function add(folderObj, msgs) {
  const local = folderObj.QueryInterface(Ci.nsIMsgLocalMailFolder);
  const built = msgs.map(build);
  local.addMessageBatch(built.map(b => b.raw));
  const db = folderObj.msgDatabase;
  const read = [];
  const unread = [];
  const flagged = [];
  msgs.forEach((m, i) => {
    const h = db.getMsgHdrForMessageID(built[i].id);
    if (!h) {
      return;
    }
    (m.unread ? unread : read).push(h);
    if (m.flagged) {
      flagged.push(h);
    }
  });
  if (read.length) {
    folderObj.markMessagesRead(read, true);
  }
  if (unread.length) {
    folderObj.markMessagesRead(unread, false);
  }
  if (flagged.length) {
    folderObj.markMessagesFlagged(flagged, true);
  }
  return built.length;
}

const counts = {
  inbox: add(inbox, INBOX),
  sent: add(sent, SENT),
  archives: add(archives, ARCHIVE),
  projetos: add(projetos, PROJETOS),
};
void drafts;
MailServices.accounts.saveAccountInfo?.();
Services.prefs.savePrefFile(null);
return { ok: true, counts };
