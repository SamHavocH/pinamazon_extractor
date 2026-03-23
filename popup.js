const affiliateTagInput = document.getElementById("affiliateTag");
const extractAndSaveBtn = document.getElementById("extractAndSaveBtn");
const openPinterestBtn = document.getElementById("openPinterestBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const itemsContainer = document.getElementById("itemsContainer");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
  console.log("[Popup]", message);
}

function sanitizeFilename(name) {
  return (name || "produto-amazon")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("Aba ativa não encontrada.");
  }

  await ensureContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: "PING" });

  return chrome.tabs.sendMessage(tab.id, message);
}

async function loadAffiliateTag() {
  const result = await chrome.storage.local.get(["affiliateTag"]);
  if (result.affiliateTag) {
    affiliateTagInput.value = result.affiliateTag;
  }
}

async function saveAffiliateTag() {
  const affiliateTag = affiliateTagInput.value.trim();
  await chrome.storage.local.set({ affiliateTag });
}

async function getSavedItems() {
  const result = await chrome.storage.local.get(["savedProducts"]);
  return result.savedProducts || [];
}

async function setSavedItems(items) {
  await chrome.storage.local.set({ savedProducts: items });
}

async function addProduct(product) {
  const items = await getSavedItems();

  const alreadyExists = items.some((item) =>
    item.asin && product.asin && item.asin === product.asin
  );

  if (alreadyExists) {
    return { added: false, reason: "duplicate" };
  }

  items.unshift(product);
  await setSavedItems(items);
  return { added: true };
}

function buildPinterestDescription(data) {
  const parts = [];

  if (data.title) {
    parts.push(`✨ ${data.title}`);
  }

  if (data.description) {
    parts.push(data.description);
  }

  if (data.affiliateUrl) {
    parts.push(`🔗 Confira aqui: ${data.affiliateUrl}`);
  }

  parts.push("#afiliado #amazon #achadinhos");

  return parts.join("\n\n");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function removeItem(id) {
  const items = await getSavedItems();
  const filtered = items.filter((item) => item.id !== id);
  await setSavedItems(filtered);
  await renderItems();
}

async function clearAllItems() {
  await setSavedItems([]);
  await renderItems();
}

async function downloadImage(item) {
  if (!item.imageUrl) {
    setStatus("Esse item não tem imagem.");
    return;
  }

  const extMatch = item.imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extMatch?.[1] || "jpg";
  const filename = `${sanitizeFilename(item.title)}.${extension}`;

  const response = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_IMAGE",
    url: item.imageUrl,
    filename
  });

  if (!response?.ok) {
    setStatus(response?.error || "Falha ao baixar imagem.");
    return;
  }

  setStatus("Download iniciado.");
}

function createItemElement(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "item";

  const descriptionForPinterest = buildPinterestDescription(item);

  wrapper.innerHTML = `
    ${item.imageUrl ? `<img class="thumb" src="${item.imageUrl}" alt="">` : ""}
    <div class="item-title">${item.title || "(sem título)"}</div>
    <div class="item-meta">
      ASIN: ${item.asin || "-"}<br>
      Capturado em: ${new Date(item.scrapedAt).toLocaleString("pt-BR")}
    </div>
    <div class="row">
      <button data-action="copy-title">Copiar título</button>
      <button data-action="copy-desc">Copiar descrição</button>
    </div>
    <div class="row" style="margin-top:8px;">
      <button data-action="copy-link">Copiar link</button>
      <button data-action="download-image">Baixar imagem</button>
    </div>
    <div class="row" style="margin-top:8px;">
      <button data-action="copy-json" class="secondary">Copiar JSON</button>
      <button data-action="remove" class="secondary">Remover</button>
    </div>
  `;

  wrapper.querySelector('[data-action="copy-title"]').addEventListener("click", async () => {
    await copyText(item.title || "");
    setStatus("Título copiado.");
  });

  wrapper.querySelector('[data-action="copy-desc"]').addEventListener("click", async () => {
    await copyText(descriptionForPinterest);
    setStatus("Descrição copiada.");
  });

  wrapper.querySelector('[data-action="copy-link"]').addEventListener("click", async () => {
    await copyText(item.affiliateUrl || item.canonicalUrl || "");
    setStatus("Link copiado.");
  });

  wrapper.querySelector('[data-action="download-image"]').addEventListener("click", async () => {
    await downloadImage(item);
  });

  wrapper.querySelector('[data-action="copy-json"]').addEventListener("click", async () => {
    await copyText(JSON.stringify(item, null, 2));
    setStatus("JSON copiado.");
  });

  wrapper.querySelector('[data-action="remove"]').addEventListener("click", async () => {
    await removeItem(item.id);
    setStatus("Item removido.");
  });

  return wrapper;
}

async function renderItems() {
  const items = await getSavedItems();
  itemsContainer.innerHTML = "";

  if (!items.length) {
    itemsContainer.innerHTML = `<div class="item-meta">Nenhum produto salvo ainda.</div>`;
    return;
  }

  for (const item of items) {
    itemsContainer.appendChild(createItemElement(item));
  }
}

extractAndSaveBtn.addEventListener("click", async () => {
  try {
    setStatus("Extraindo produto...");
    await saveAffiliateTag();

    const affiliateTag = affiliateTagInput.value.trim();

    const response = await sendToActiveTab({
      type: "EXTRACT_PRODUCT",
      affiliateTag
    });

    if (!response?.ok || !response?.data) {
      setStatus(response?.error || "Falha ao extrair produto.");
      return;
    }

    const result = await addProduct(response.data);

    if (!result.added && result.reason === "duplicate") {
      setStatus("Esse produto já está na lista.");
      return;
    }

    await renderItems();
    setStatus("Produto salvo na lista.");
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "Erro inesperado.");
  }
});

openPinterestBtn.addEventListener("click", async () => {
  try {
    await chrome.tabs.create({
      url: "https://www.pinterest.com/pin-creation-tool/"
    });
    setStatus("Pinterest aberto.");
  } catch (error) {
    setStatus("Não foi possível abrir o Pinterest.");
  }
});

clearAllBtn.addEventListener("click", async () => {
  await clearAllItems();
  setStatus("Lista limpa.");
});

loadAffiliateTag();
renderItems();