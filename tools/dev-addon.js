// Instala (ou recarrega) o addon a partir de addon/ como complemento temporário
// no perfil de desenvolvimento. Uso:
//   python3 tools/tbctl.py exec --port 2850 --file tools/dev-addon.js \
//     --args '{"dir": "/caminho/para/addon", "action": "install"}'
// action: "install" (padrão; também recarrega), "uninstall", "disable", "enable",
//   "xpi" (instalação normal, permanente, de um .xpi em "dir" — como "Instalar
//   de um arquivo…"; serve para testar atualização por cima de outra versão;
//   "id" opcional para instalar outros addons).

const ARGS = arguments[0] ?? {};

const { AddonManager } = ChromeUtils.importESModule(
  "resource://gre/modules/AddonManager.sys.mjs"
);
const ID = ARGS.id || "theme@theunfound.com.br";
const action = ARGS.action || "install";
const existing = await AddonManager.getAddonByID(ID);

if (action == "xpi") {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(ARGS.dir);
  const install = await AddonManager.getInstallForFile(file);
  const addon = await install.install();
  await new Promise(r => setTimeout(r, 2000));
  return { ok: true, action, id: addon.id, version: addon.version, active: addon.isActive, temp: addon.temporarilyInstalled };
}

if (action == "uninstall") {
  await existing?.uninstall();
  return { ok: true, action };
}
if (action == "disable") {
  await existing?.disable();
  return { ok: true, action, active: existing?.isActive };
}
if (action == "enable") {
  await existing?.enable();
  return { ok: true, action, active: existing?.isActive };
}

const dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
dir.initWithPath(ARGS.dir);
const addon = await AddonManager.installTemporaryAddon(dir);
await new Promise(r => setTimeout(r, 1500));
return { ok: true, action, id: addon.id, version: addon.version, active: addon.isActive };
