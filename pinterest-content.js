function log(...args) {
  console.log("[Pinterest Panel]", ...args);
}

const PANEL_ID = "amazon-pinterest-helper-panel";
const TOGGLE_ID = "amazon-pinterest-helper-toggle";

function getPanelState() {
  try {
    return JSON.parse(localStorage.getItem("aph_panel_state") || "{}");
  } catch {
    return {};
  }
}

function savePanelState(next) {
  const current = getPanelState();
  localStorage.setItem("aph_panel_state", JSON.stringify({ ...current, ...next }));
}

function buildDescription(item) {
  return [
    item.title ? `✨ ${item.title}` : "",
    item.description || "",
    item.affiliateUrl ? `🔗 Confira aqui: ${item.affiliateUrl}` : "",
    "#afiliado #amazon #achadinhos"
  ].filter(Boolean).join("\n\n");
}

function setNativeValue(element, value) {
  const tag = element.tagName.toLowerCase();

  if (tag === "input" || tag === "textarea") {
    const prototype =
      tag === "input"
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  if (element.isContentEditable) {
    element.focus();
    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  return false;
}

function getTextInputs() {
  return [...document.querySelectorAll('input, textarea, [contenteditable="true"]')];
}

function scoreField(el) {
  return [
    el.getAttribute("aria-label"),
    el.getAttribute("placeholder"),
    el.getAttribute("name"),
    el.getAttribute("id"),
    el.closest("label")?.innerText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function findBestField(keywords) {
  const fields = getTextInputs();

  for (const field of fields) {
    const text = scoreField(field);
    if (keywords.some((k) => text.includes(k))) {
      return field;
    }
  }

  return null;
}

async function tryAutofill(item) {
  const titleField = findBestField(["title", "título", "titulo"]);
  const descField = findBestField(["description", "descrição", "descricao"]);
  const linkField = findBestField(["link", "destination", "website", "site", "url"]);

  const result = {
    title: false,
    description: false,
    link: false
  };

  if (titleField && item.title) {
    result.title = setNativeValue(titleField, item.title);
  }

  const descriptionText = buildDescription(item);

  if (descField && descriptionText) {
    result.description = setNativeValue(descField, descriptionText);
  }

  if (linkField && (item.affiliateUrl || item.canonicalUrl)) {
    result.link = setNativeValue(linkField, item.affiliateUrl || item.canonicalUrl);
  }

  log("autofill result", result);
  return result;
}

async function getProducts() {
  const result = await chrome.storage.local.get(["savedProducts"]);
  return result.savedProducts || [];
}

function createToggleButton() {
  let toggle = document.getElementById(TOGGLE_ID);
  if (toggle) return toggle;

  toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.textContent = "Abrir lista";
  toggle.style.position = "fixed";
  toggle.style.right = "16px";
  toggle.style.bottom = "16px";
  toggle.style.zIndex = "999999";
  toggle.style.background = "#e60023";
  toggle.style.color = "#fff";
  toggle.style.border = "0";
  toggle.style.borderRadius = "999px";
  toggle.style.padding = "10px 14px";
  toggle.style.cursor = "pointer";
  toggle.style.fontSize = "13px";
  toggle.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
  toggle.style.display = "none";

  toggle.addEventListener("click", () => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.style.display = "block";
    toggle.style.display = "none";
    savePanelState({ hidden: false, minimized: false });
  });

  document.body.appendChild(toggle);
  return toggle;
}

function makeDraggable(panel, handle) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${Math.max(8, e.clientX - offsetX)}px`;
    panel.style.top = `${Math.max(8, e.clientY - offsetY)}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
  });
}

function createButton(label) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.padding = "7px 8px";
  btn.style.border = "0";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.background = "#111";
  btn.style.color = "#fff";
  btn.style.fontSize = "12px";
  return btn;
}

async function renderPanelItems() {
  const body = document.getElementById("aph-panel-body");
  if (!body) return;

  const products = await getProducts();
  body.innerHTML = "";

  if (!products.length) {
    body.innerHTML = `<div style="font-size:12px;color:#666;">Nenhum produto salvo.</div>`;
    return;
  }

  for (const item of products) {
    const card = document.createElement("div");
    card.style.border = "1px solid #e5e5e5";
    card.style.borderRadius = "10px";
    card.style.padding = "8px";
    card.style.marginBottom = "8px";
    card.style.background = "#fff";

    if (item.imageUrl) {
      const imageWrap = document.createElement("div");
      imageWrap.style.display = "flex";
      imageWrap.style.justifyContent = "center";
      imageWrap.style.marginBottom = "8px";

      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.title || "Produto";
      img.style.width = "64px";
      img.style.height = "64px";
      img.style.objectFit = "contain";
      img.style.border = "1px solid #eee";
      img.style.borderRadius = "8px";
      img.style.background = "#fafafa";
      img.style.display = "block";

      imageWrap.appendChild(img);
      card.appendChild(imageWrap);
    }

    const title = document.createElement("div");
    title.textContent = item.title || "(sem título)";
    title.style.fontSize = "12px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "6px";
    title.style.lineHeight = "1.3";

    const meta = document.createElement("div");
    meta.textContent = `ASIN: ${item.asin || "-"}`;
    meta.style.fontSize = "11px";
    meta.style.color = "#666";
    meta.style.marginBottom = "8px";

    const actions = document.createElement("div");
    actions.style.display = "grid";
    actions.style.gridTemplateColumns = "1fr 1fr";
    actions.style.gap = "6px";

    const copyTitleBtn = createButton("Título");
    const copyDescBtn = createButton("Descrição");
    const copyLinkBtn = createButton("Link");
    const autofillBtn = createButton("Inserir");

    copyTitleBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.title || "");
    });

    copyDescBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(buildDescription(item));
    });

    copyLinkBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.affiliateUrl || item.canonicalUrl || "");
    });

    autofillBtn.addEventListener("click", async () => {
      await tryAutofill(item);
    });

    actions.append(copyTitleBtn, copyDescBtn, copyLinkBtn, autofillBtn);
    card.append(title, meta, actions);
    body.appendChild(card);
  }
}

async function buildPanel() {
  if (document.getElementById(PANEL_ID)) return;

  const state = getPanelState();
  const toggle = createToggleButton();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.position = "fixed";
  panel.style.top = state.top || "16px";
  panel.style.right = state.left ? "auto" : "16px";
  panel.style.left = state.left || "auto";
  panel.style.width = "280px";
  panel.style.maxHeight = "70vh";
  panel.style.zIndex = "999999";
  panel.style.background = "#ffffff";
  panel.style.color = "#111";
  panel.style.border = "1px solid #ddd";
  panel.style.borderRadius = "14px";
  panel.style.boxShadow = "0 12px 30px rgba(0,0,0,0.18)";
  panel.style.overflow = "hidden";
  panel.style.fontFamily = "Arial, sans-serif";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px 12px";
  header.style.background = "#fafafa";
  header.style.borderBottom = "1px solid #eee";
  header.style.cursor = "move";

  const title = document.createElement("div");
  title.textContent = "Produtos salvos";
  title.style.fontSize = "13px";
  title.style.fontWeight = "bold";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "6px";

  const minimizeBtn = document.createElement("button");
  minimizeBtn.textContent = "—";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";

  [minimizeBtn, closeBtn].forEach((btn) => {
    btn.style.width = "28px";
    btn.style.height = "28px";
    btn.style.border = "0";
    btn.style.borderRadius = "8px";
    btn.style.cursor = "pointer";
    btn.style.background = "#eee";
    btn.style.fontSize = "14px";
  });

  const content = document.createElement("div");
  content.id = "aph-panel-content";
  content.style.padding = "10px";
  content.style.maxHeight = "calc(70vh - 48px)";
  content.style.overflow = "auto";

  const body = document.createElement("div");
  body.id = "aph-panel-body";

  content.appendChild(body);
  controls.append(minimizeBtn, closeBtn);
  header.append(title, controls);
  panel.append(header, content);
  document.body.appendChild(panel);

  makeDraggable(panel, header);

  minimizeBtn.addEventListener("click", () => {
    const isHidden = content.style.display === "none";
    content.style.display = isHidden ? "block" : "none";
    minimizeBtn.textContent = isHidden ? "—" : "+";
    savePanelState({ minimized: !isHidden });
  });

  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
    toggle.style.display = "block";
    savePanelState({ hidden: true });
  });

  if (state.minimized) {
    content.style.display = "none";
    minimizeBtn.textContent = "+";
  }

  if (state.hidden) {
    panel.style.display = "none";
    toggle.style.display = "block";
  }

  await renderPanelItems();
}

buildPanel();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.savedProducts) {
    renderPanelItems();
  }
});