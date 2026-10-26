/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DEFAULTS = {
  theme: "auto",
  avatars: true,
  previews: true,
  senderDisplay: "smart",
  proportionalPlainText: true,
  darkSidebar: true,
};
const CHECKBOXES = ["avatars", "previews", "proportionalPlainText", "darkSidebar"];
const RADIOS = ["theme", "senderDisplay"];
const PHOTO_SIZE = 128;
const PHOTO_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,/;

async function load() {
  const stored = await browser.storage.local.get(null);
  // Valor antigo (v0.1), caso o background ainda não tenha migrado.
  if (stored.senderDisplay === undefined && "senderNameOnly" in stored) {
    stored.senderDisplay = stored.senderNameOnly ? "smart" : "full";
  }
  const options = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    options[key] = stored[key] ?? DEFAULTS[key];
  }
  for (const name of RADIOS) {
    for (const radio of document.querySelectorAll(`input[name="${name}"]`)) {
      radio.checked = radio.value == options[name];
      radio.addEventListener("change", () => {
        if (radio.checked) {
          browser.storage.local.set({ [name]: radio.value });
        }
      });
    }
  }
  for (const id of CHECKBOXES) {
    const box = document.getElementById(id);
    box.checked = !!options[id];
    box.addEventListener("change", () => {
      browser.storage.local.set({ [id]: box.checked });
    });
  }
  await Promise.all([updateLayoutStatus(), renderAccounts()]);
}

async function updateLayoutStatus() {
  const state = await browser.unfoundTheme.getLayoutState();
  const status = document.getElementById("layoutStatus");
  const button = document.getElementById("applyLayout");
  const ok = state.cardsView && state.verticalLayout && state.threeLineCards;
  status.textContent = ok
    ? "A visualização em cartões (3 linhas) e o layout de 3 colunas já estão ativos."
    : "Os cartões com avatar e prévia pedem a visualização em cartões com 3 linhas e o layout vertical (3 colunas).";
  button.hidden = ok;
}

document.getElementById("applyLayout").addEventListener("click", async () => {
  await browser.unfoundTheme.applyRecommendedLayout();
  await updateLayoutStatus();
});

// ---------------------------------------------------------------------------
// Contas: foto de cada conta no trilho recolhido.

// Mesma cor e iniciais dos avatares da lista (threadDecorator.js).
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

function setStatus(text) {
  document.getElementById("accountsStatus").textContent = text;
}

async function storedPhotos() {
  const { accountPhotos } = await browser.storage.local.get("accountPhotos");
  return accountPhotos && typeof accountPhotos == "object" ? { ...accountPhotos } : {};
}

function avatarFor(account, photo) {
  const avatar = document.createElement("span");
  avatar.className = "account-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.style.setProperty(
    "--avatar-hue",
    hueFor((account.email || account.name || "?").toLowerCase())
  );
  const initials = initialsFor(account.fullName || account.name, account.email);
  if (photo) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = photo;
    img.addEventListener("error", () => avatar.replaceChildren(initials), { once: true });
    avatar.append(img);
  } else {
    avatar.textContent = initials;
  }
  return avatar;
}

async function renderAccounts() {
  const list = document.getElementById("accounts");
  let accounts = [];
  try {
    accounts = await browser.unfoundTheme.getAccounts();
  } catch (e) {
    console.error(e);
  }
  const photos = await storedPhotos();
  const rows = accounts.map(account => {
    const custom = PHOTO_URL.test(photos[account.key] ?? "") ? photos[account.key] : "";
    const photo = custom || account.addressBookPhoto;
    const source = custom
      ? "Imagem escolhida aqui"
      : account.addressBookPhoto
        ? "Foto do catálogo de endereços"
        : "Iniciais (sem foto)";

    const row = document.createElement("li");
    row.className = "account";

    const text = document.createElement("span");
    text.className = "account-text";
    const name = document.createElement("strong");
    name.textContent = account.name;
    text.append(name);
    if (account.email && account.email != account.name) {
      const email = document.createElement("small");
      email.textContent = account.email;
      text.append(email);
    }
    const origin = document.createElement("small");
    origin.className = custom ? "account-source is-custom" : "account-source";
    origin.textContent = source;
    text.append(origin);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.hidden = true;
    input.addEventListener("change", () => savePhoto(account, input.files?.[0]));

    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "secondary";
    choose.textContent = "Escolher imagem…";
    choose.setAttribute("aria-label", `Escolher imagem para ${account.name}`);
    choose.addEventListener("click", () => {
      input.value = "";
      input.click();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remover";
    remove.hidden = !custom;
    remove.setAttribute("aria-label", `Remover a imagem de ${account.name}`);
    remove.addEventListener("click", async () => {
      const current = await storedPhotos();
      delete current[account.key];
      await browser.storage.local.set({ accountPhotos: current });
      setStatus(`Imagem de ${account.name} removida.`);
      await renderAccounts();
      document.querySelector(`[data-key="${CSS.escape(account.key)}"] button`)?.focus();
    });

    const actions = document.createElement("span");
    actions.className = "account-actions";
    actions.append(choose, remove, input);

    row.dataset.key = account.key;
    row.append(avatarFor(account, photo), text, actions);
    return row;
  });
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "hint";
    empty.textContent = "Nenhuma conta de e-mail com Caixa de entrada.";
    rows.push(empty);
  }
  list.replaceChildren(...rows);
}

/** Recorta a imagem ao centro e reduz para um quadrado pequeno. */
async function photoDataURL(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error("imagem sem tamanho");
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      PHOTO_SIZE,
      PHOTO_SIZE
    );
    const webp = canvas.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function savePhoto(account, file) {
  if (!file) {
    return;
  }
  try {
    const dataURL = await photoDataURL(file);
    const photos = await storedPhotos();
    photos[account.key] = dataURL;
    await browser.storage.local.set({ accountPhotos: photos });
    setStatus(`Imagem de ${account.name} salva.`);
  } catch (e) {
    console.error(e);
    setStatus("Não foi possível usar esse arquivo. Escolha uma imagem PNG, JPEG, WebP ou GIF.");
  }
  await renderAccounts();
  document.querySelector(`[data-key="${CSS.escape(account.key)}"] button`)?.focus();
}

load();
