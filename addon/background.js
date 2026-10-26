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
  accountPhotos: {},
};

const PHOTO_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,/;

/** Só fotos embutidas (data:image/…) com chave de conta. */
function cleanPhotos(value) {
  const photos = {};
  if (value && typeof value == "object" && !Array.isArray(value)) {
    for (const [key, url] of Object.entries(value)) {
      if (typeof url == "string" && PHOTO_URL.test(url)) {
        photos[key] = url;
      }
    }
  }
  return photos;
}

/** Lê as opções salvas, completando com os padrões o que ainda não foi gravado. */
async function loadOptions() {
  const stored = await browser.storage.local.get(null);
  const options = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    options[key] = stored[key] ?? fallback;
  }
  options.darkSidebar = options.darkSidebar !== false;
  options.accountPhotos = cleanPhotos(options.accountPhotos);
  return options;
}

async function applyStoredOptions() {
  await browser.unfoundTheme.configure(await loadOptions());
}

browser.runtime.onStartup.addListener(applyStoredOptions);
browser.runtime.onInstalled.addListener(applyStoredOptions);
browser.storage.onChanged.addListener((changes, area) => {
  if (area == "local") {
    applyStoredOptions();
  }
});

applyStoredOptions();
