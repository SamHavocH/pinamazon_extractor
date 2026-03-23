function log(...args) {
  console.log("[Amazon Helper]", ...args);
}

function textOrNull(value) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function getMetaContent(selector) {
  const el = document.querySelector(selector);
  log("getMetaContent", selector, !!el, el?.content);
  return el?.content ? el.content.trim() : null;
}

function getText(selector) {
  const el = document.querySelector(selector);
  const value = textOrNull(el?.innerText || el?.textContent || null);
  log("getText", selector, !!el, value);
  return value;
}

function getAttribute(selector, attr) {
  const el = document.querySelector(selector);
  const value = el?.getAttribute(attr) || null;
  log("getAttribute", selector, attr, !!el, value);
  return value;
}

function extractASIN() {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i
  ];

  const href = window.location.href;

  for (const pattern of patterns) {
    const match = href.match(pattern);
    if (match) {
      const asin = match[1].toUpperCase();
      log("ASIN via URL", asin);
      return asin;
    }
  }

  const hiddenAsin = document.querySelector("#ASIN, input[name='ASIN'], input[name='asin']");
  if (hiddenAsin?.value) {
    const asin = hiddenAsin.value.toUpperCase();
    log("ASIN via hidden input", asin);
    return asin;
  }

  log("ASIN não encontrado");
  return null;
}

function extractTitle() {
  const title =
    getText("#productTitle") ||
    getMetaContent('meta[property="og:title"]') ||
    textOrNull(document.title.replace(/\s*:\s*Amazon.*$/i, "")) ||
    null;

  log("title final", title);
  return title;
}

function extractImageUrl() {
  const candidates = [
    getAttribute("#landingImage", "src"),
    getAttribute("#landingImage", "data-old-hires"),
    getAttribute("#imgTagWrapperId img", "src"),
    getAttribute("#imgTagWrapperId img", "data-old-hires"),
    getMetaContent('meta[property="og:image"]')
  ].filter(Boolean);

  const imageUrl = candidates[0] || null;
  log("image candidates", candidates);
  log("image final", imageUrl);
  return imageUrl;
}

function extractDescription() {
  const bullets = [...document.querySelectorAll("#feature-bullets ul li span")]
    .map((el) => textOrNull(el.innerText))
    .filter(Boolean)
    .filter((t) => !t.toLowerCase().includes("certifique-se de que isso se encaixa"))
    .filter((t) => !t.toLowerCase().includes("make sure this fits"));

  log("bullets", bullets);

  if (bullets.length) {
    return bullets.join(" • ");
  }

  const description =
    getText("#productDescription") ||
    getText("#bookDescription_feature_div") ||
    getMetaContent('meta[name="description"]') ||
    null;

  log("description final", description);
  return description;
}

function buildCanonicalUrl(asin) {
  const url = asin ? `${location.origin}/dp/${asin}` : window.location.href;
  log("canonicalUrl", url);
  return url;
}

function buildAffiliateUrl(canonicalUrl, affiliateTag) {
  if (!canonicalUrl) return null;

  const url = new URL(canonicalUrl);
  if (affiliateTag) {
    url.searchParams.set("tag", affiliateTag);
  }

  const result = url.toString();
  log("affiliateUrl", result);
  return result;
}

function extractData(affiliateTag = "") {
  log("Iniciando extração", window.location.href);

  const asin = extractASIN();
  const title = extractTitle();
  const imageUrl = extractImageUrl();
  const description = extractDescription();
  const canonicalUrl = buildCanonicalUrl(asin);
  const affiliateUrl = buildAffiliateUrl(canonicalUrl, affiliateTag);

  const data = {
    asin,
    title,
    imageUrl,
    description,
    canonicalUrl,
    affiliateUrl,
    domain: location.hostname,
    scrapedAt: new Date().toISOString()
  };

  log("data final", data);
  return data;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("Mensagem recebida", message);

  if (message.type === "PING") {
    sendResponse({ ok: true, pong: true, href: location.href });
    return true;
  }

  if (message.type === "EXTRACT_PRODUCT") {
    try {
      const data = extractData(message.affiliateTag || "");
      sendResponse({ ok: true, data });
    } catch (error) {
      console.error("[Amazon Helper] erro na extração", error);
      sendResponse({
        ok: false,
        error: error?.message || "Erro ao extrair dados da página."
      });
    }
  }

  return true;
});