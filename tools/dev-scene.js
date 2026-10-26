// Monta a cena padrão para screenshots: Entrada da conta de exemplo aberta e
// uma mensagem selecionada no painel de leitura.
// Uso: python3 tools/tbctl.py exec --port 2850 --file tools/dev-scene.js
// --args opcional: {"subject": "...", "scheme": "light" | "dark" | "none",
//                  "expand": true (expande a conversa do topo),
//                  "author": "trecho do remetente" (desempate)}.

const ARGS = arguments[0] ?? {};

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
const subject = ARGS.subject || "Proposta comercial revisada";
const scheme = ARGS.scheme || "none";

window.browsingContext.prefersColorSchemeOverride = scheme;
window.resizeTo(1440, 900);

const tabmail = window.gTabmail;
tabmail.switchToTab(0);
const about3Pane = tabmail.currentAbout3Pane;
const inbox = MailServices.accounts.defaultAccount.incomingServer.rootFolder.getFolderWithFlags(
  Ci.nsMsgFolderFlags.Inbox
);
if (about3Pane.gFolder?.URI != inbox.URI) {
  about3Pane.displayFolder(inbox.URI);
  await new Promise(r => setTimeout(r, 800));
}

// Conversa do topo expandida ou recolhida (padrão: recolhida).
const view = about3Pane.gDBView;
const firstOpen = view.rowCount > 0 && !view.isContainerOpen(0) ? false : true;
if (view.rowCount > 0 && view.isContainer(0) && firstOpen != !!ARGS.expand) {
  view.toggleOpenState(0);
  await new Promise(r => setTimeout(r, 400));
}

const db = inbox.msgDatabase;
let target = null;
for (const hdr of db.enumerateMessages()) {
  if (
    hdr.mime2DecodedSubject == subject.replace(/^Re: /, "") &&
    (!ARGS.author || hdr.mime2DecodedAuthor.includes(ARGS.author))
  ) {
    target = hdr;
    break;
  }
}
if (target) {
  const index = about3Pane.gDBView.findIndexOfMsgHdr(target, true);
  about3Pane.threadTree.selectedIndex = index;
  about3Pane.threadTree.scrollToIndex(0, true);
}
await new Promise(r => setTimeout(r, 1500));
about3Pane.threadTree.table.body.focus();
return {
  folder: about3Pane.gFolder?.prettyName,
  selected: target?.mime2DecodedSubject ?? null,
  size: [window.outerWidth, window.outerHeight],
  dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
};
