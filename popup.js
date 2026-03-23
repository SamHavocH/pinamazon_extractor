const affiliateTagInput = document.getElementById("affiliateTag");
const extractBtn = document.getElementById("extractBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const downloadImageBtn = document.getElementById("downloadImageBtn");

const titleField = document.getElementById("title");
const descriptionField = document.getElementById("description");
const imageUrlField = document.getElementById("imageUrl");
const affiliateUrlField = document.getElementById("affiliateUrl");
const previewImage = document.getElementById("previewImage");
const statusEl = document.getElementById("status");

let currentData = null;

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
  console.log("[Popup] active tab", tab);
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

  try {
    const ping = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
    console.log("[Popup] ping response", ping);
  } catch (err) {
    console.error("[Popup] falha no ping", err);
    throw new Error("Não consegui conectar com o content script.");
  }

  return chrome.tabs.sendMessage(tab.id, message);
}

async function loadSavedTag() {
  const result = await chrome.storage.local.get(["affiliateTag"]);
  if (result.affiliateTag) {
    affiliateTagInput.value = result.affiliateTag;
  }
}

async function saveTag() {
  const affiliateTag = affiliateTagInput.value.trim();
  await chrome.storage.local.set({ affiliateTag });
}

extractBtn.addEventListener("click", async () => {
  try {
    setStatus("Extraindo...");
    const affiliateTag = affiliateTagInput.value.trim();
    await saveTag();

    const response = await sendToActiveTab({
      type: "EXTRACT_PRODUCT",
      affiliateTag
    });

    console.log("[Popup] extract response", response);

    if (!response?.ok) {
      setStatus(response?.error || "Falha ao extrair dados.");
      return;
    }

    currentData = response.data;

    titleField.value = currentData.title || "";
    descriptionField.value = currentData.description || "";
    imageUrlField.value = currentData.imageUrl || "";
    affiliateUrlField.value = currentData.affiliateUrl || "";

    if (currentData.imageUrl) {
      previewImage.src = currentData.imageUrl;
      previewImage.style.display = "block";
    } else {
      previewImage.style.display = "none";
    }

    setStatus("Dados extraídos com sucesso.");
  } catch (error) {
    console.error("[Popup] erro", error);
    setStatus(error?.message || "Erro inesperado.");
  }
});

copyJsonBtn.addEventListener("click", async () => {
  try {
    const data = {
      title: titleField.value.trim(),
      description: descriptionField.value.trim(),
      imageUrl: imageUrlField.value.trim(),
      affiliateUrl: affiliateUrlField.value.trim()
    };

    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setStatus("JSON copiado para a área de transferência.");
  } catch (error) {
    console.error("[Popup] copy error", error);
    setStatus("Não foi possível copiar o JSON.");
  }
});

downloadImageBtn.addEventListener("click", async () => {
  try {
    const imageUrl = imageUrlField.value.trim();
    const title = titleField.value.trim();

    if (!imageUrl) {
      setStatus("Nenhuma URL de imagem disponível.");
      return;
    }

    const extMatch = imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const extension = extMatch?.[1] || "jpg";
    const filename = `${sanitizeFilename(title)}.${extension}`;

    console.log("[Popup] download start", { imageUrl, filename });

    const response = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_IMAGE",
      url: imageUrl,
      filename
    });

    console.log("[Popup] download response", response);

    if (!response?.ok) {
      setStatus(response?.error || "Falha ao baixar a imagem.");
      return;
    }

    setStatus("Download iniciado.");
  } catch (error) {
    console.error("[Popup] download error", error);
    setStatus(error?.message || "Erro ao baixar imagem.");
  }
});

loadSavedTag();