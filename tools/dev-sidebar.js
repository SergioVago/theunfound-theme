// Cena da barra lateral para screenshots: tema, painel recolhido ou não e a
// Entrada de uma conta aberta. Devolve o estado do trilho e a largura.
// Uso: python3 tools/tbctl.py exec --port 2860 --file tools/dev-sidebar.js \
//   --args '{"scheme": "light", "collapsed": true, "account": "daniel@empresa.exemplo.com.br"}'
// "collapsed" omitido = não mexe; "account" omitido = conta padrão;
// "focus": "rail" | "tree" | "list" escolhe onde fica o foco.

const ARGS = arguments[0] ?? {};

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
const sleep = ms => new Promise(r => setTimeout(r, ms));

window.browsingContext.prefersColorSchemeOverride = ARGS.scheme || "none";
window.resizeTo(1440, 900);

const tabmail = window.gTabmail;
tabmail.switchToTab(0);
const about3Pane = tabmail.currentAbout3Pane;
const doc = about3Pane.document;

const account = ARGS.account
  ? MailServices.accounts.accounts.find(a => a.defaultIdentity?.email == ARGS.account)
  : MailServices.accounts.defaultAccount;
const inbox = account.incomingServer.rootMsgFolder.getFolderWithFlags(
  Ci.nsMsgFolderFlags.Inbox
);
if (about3Pane.gFolder?.URI != inbox.URI) {
  about3Pane.displayFolder(inbox);
  await sleep(800);
}

if (typeof ARGS.collapsed == "boolean") {
  const isCollapsed = doc.documentElement.hasAttribute("unf-folder-rail");
  if (isCollapsed != ARGS.collapsed) {
    doc.querySelector(ARGS.collapsed ? "#folderPaneHeaderBar .unf-rail-collapse" : ".unf-rail-expand")?.click();
    await sleep(300);
  }
}

if (about3Pane.threadTree.view?.rowCount && ARGS.select !== false) {
  about3Pane.threadTree.selectedIndex = 0;
  await sleep(900);
}

if (ARGS.focus == "rail") {
  doc.querySelector(".unf-rail-account[aria-current]")?.focus();
} else if (ARGS.focus == "tree") {
  doc.getElementById("folderTree").focus();
} else {
  about3Pane.threadTree.table.body.focus();
}
await sleep(400);

const rect = el => {
  const b = el?.getBoundingClientRect();
  return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null;
};
return {
  folder: `${about3Pane.gFolder?.server.prettyName} / ${about3Pane.gFolder?.localizedName}`,
  collapsed: doc.documentElement.hasAttribute("unf-folder-rail"),
  lightSidebar: doc.documentElement.hasAttribute("unf-light-sidebar"),
  folderPane: rect(doc.getElementById("folderPane")),
  splitterVar: doc.body.style.getPropertyValue("--folderPaneSplitter-width"),
  storedWidth: Services.xulStore.getValue("chrome://messenger/content/messenger.xhtml", "folderPaneBox", "width"),
  rail: [...doc.querySelectorAll(".unf-rail-account")].map(b => ({
    label: b.getAttribute("aria-label"),
    badge: b.querySelector(".unf-rail-badge").hidden ? null : b.querySelector(".unf-rail-badge").textContent,
    current: b.hasAttribute("aria-current"),
    photo: !!b.querySelector("img"),
  })),
  dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
};
