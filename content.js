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
  return el?.content ? el.content.trim() : null;
}

function getText(selector) {
  const el = document.querySelector(selector);
  return textOrNull(el?.innerText || el?.textContent || null);
}

function getAttribute(selector, attr) {
  const el = document.querySelector(selector);
  return el?.getAttribute(attr) || null;
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
    if (match) return match[1].toUpperCase();
  }

  const hiddenAsin = document.querySelector("#ASIN, input[name='ASIN'], input[name='asin']");
  if (hiddenAsin?.value) return hiddenAsin.value.toUpperCase();

  return null;
}

function extractTitle() {
  return (
    getText("#productTitle") ||
    getMetaContent('meta[property="og:title"]') ||
    textOrNull(document.title.replace(/\s*:\s*Amazon.*$/i, "")) ||
    null
  );
}

function extractImageUrl() {
  const candidates = [
    getAttribute("#landingImage", "src"),
    getAttribute("#landingImage", "data-old-hires"),
    getAttribute("#imgTagWrapperId img", "src"),
    getAttribute("#imgTagWrapperId img", "data-old-hires"),
    getMetaContent('meta[property="og:image"]')
  ].filter(Boolean);

  return candidates[0] || null;
}

function extractDescription() {
  const bullets = [...document.querySelectorAll("#feature-bullets ul li span")]
    .map((el) => textOrNull(el.innerText))
    .filter(Boolean)
    .filter((t) => !t.toLowerCase().includes("certifique-se de que isso se encaixa"))
    .filter((t) => !t.toLowerCase().includes("make sure this fits"));

  if (bullets.length) {
    return bullets.join(" • ");
  }

  return (
    getText("#productDescription") ||
    getText("#bookDescription_feature_div") ||
    getMetaContent('meta[name="description"]') ||
    null
  );
}

function buildCanonicalUrl(asin) {
  return asin ? `${location.origin}/dp/${asin}` : window.location.href;
}

function buildAffiliateUrl(canonicalUrl, affiliateTag) {
  if (!canonicalUrl) return null;
  const url = new URL(canonicalUrl);
  if (affiliateTag) {
    url.searchParams.set("tag", affiliateTag);
  }
  return url.toString();
}

function extractData(affiliateTag = "") {
  const asin = extractASIN();
  const title = extractTitle();
  const imageUrl = extractImageUrl();
  const description = extractDescription();
  const canonicalUrl = buildCanonicalUrl(asin);
  const affiliateUrl = buildAffiliateUrl(canonicalUrl, affiliateTag);

  return {
    id: `${asin || "noasin"}_${Date.now()}`,
    asin,
    title,
    imageUrl,
    description,
    canonicalUrl,
    affiliateUrl,
    domain: location.hostname,
    scrapedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true, href: location.href });
    return true;
  }

  if (message.type === "EXTRACT_PRODUCT") {
    try {
      const data = extractData(message.affiliateTag || "");
      sendResponse({ ok: true, data });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error?.message || "Erro ao extrair produto."
      });
    }
  }

  return true;
});