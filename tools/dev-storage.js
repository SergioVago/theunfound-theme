// Lê/grava o storage.local do addon a partir do processo principal, como se
// fosse a página de opções (dispara storage.onChanged no background). Uso:
//   python3 tools/tbctl.py exec --port 2860 --file tools/dev-storage.js \
//     --args '{"set": {"darkSidebar": false}}'
//   --args '{"remove": ["darkSidebar"]}' | '{"get": true}'
//   --args '{"photo": {"account": "account3", "colors": ["#111827", "#f97316"], "text": "U"}}'
//     (gera uma imagem 128×128 e a grava em accountPhotos, como o upload faria)

const ARGS = arguments[0] ?? {};
const ID = "theme@theunfound.com.br";

const { ExtensionParent } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionParent.sys.mjs"
);
const { ExtensionStorageIDB } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionStorageIDB.sys.mjs"
);

const extension = ExtensionParent.GlobalManager.getExtension(ID);
if (!extension) {
  throw new Error("addon não está ativo");
}
await ExtensionStorageIDB.selectBackend({ extension });
const db = await ExtensionStorageIDB.open(
  ExtensionStorageIDB.getStoragePrincipal(extension),
  false
);

async function call(method, ...args) {
  const changes = await db[method](...args);
  if (changes) {
    ExtensionStorageIDB.notifyListeners(ID, changes);
  }
  return changes;
}

function photo({ colors = ["#111827", "#f97316"], text = "U" }) {
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 70);
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

if (ARGS.set) {
  await call("set", ARGS.set);
}
if (ARGS.remove) {
  await call("remove", ARGS.remove);
}
if (ARGS.photo) {
  const current = (await db.get("accountPhotos")).accountPhotos ?? {};
  current[ARGS.photo.account] = photo(ARGS.photo);
  await call("set", { accountPhotos: current });
}
const all = await db.get(null);
if (all.accountPhotos) {
  all.accountPhotos = Object.fromEntries(
    Object.entries(all.accountPhotos).map(([k, v]) => [k, `${v.slice(0, 30)}… (${v.length})`])
  );
}
return all;
