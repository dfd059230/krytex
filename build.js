#!/usr/bin/env node
/* KRYTEX static i18n builder.
 * Reads index.template.html (the data-i18n template) + the I18N/META dictionaries
 * from js/main.js, and bakes one fully-translated, SEO-ready HTML page per language:
 *   /index.html (zh, root)   /en/index.html   /ru/index.html
 * Re-run after editing index.template.html or the dictionaries:  node build.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const template = fs.readFileSync(path.join(ROOT, "index.template.html"), "utf8");
const mainjs = fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf8");

// --- extract a top-level `const NAME = { ... };` object literal from main.js ---
function extractObj(name) {
  const start = mainjs.indexOf("const " + name + " =");
  const braceStart = mainjs.indexOf("{", start);
  let depth = 0, i = braceStart, inStr = false, q = "";
  for (; i < mainjs.length; i++) {
    const c = mainjs[i];
    if (inStr) { if (c === q && mainjs[i - 1] !== "\\") inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  const literal = mainjs.slice(braceStart, i);
  return (0, eval)("(" + literal + ")");
}
const I18N = extractObj("I18N");
const META = extractObj("META");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

const BASE = "https://krytex.world";
const HREFLANG = [
  `<link rel="alternate" hreflang="zh-Hans" href="${BASE}/">`,
  `<link rel="alternate" hreflang="en" href="${BASE}/en/">`,
  `<link rel="alternate" hreflang="ru" href="${BASE}/ru/">`,
  `<link rel="alternate" hreflang="x-default" href="${BASE}/">`,
].join("\n");

const KEYWORDS = {
  zh: "KRYTEX,陶瓷镀晶,汽车镀晶,汽车养护,纳米涂层,汽车美容,经销商合作,钛能镀膜,ceramic coating",
  en: "KRYTEX, ceramic coating, nano coating, titanium coating, paint protection, car detailing, auto care, dealer partnership, China distributor",
  ru: "KRYTEX, керамическое покрытие, нанокерамика, титановое покрытие, защита ЛКП, автохимия, детейлинг, дилерство, дистрибуция в Китае",
};
const OG_LOCALE = { zh: "zh_CN", en: "en_US", ru: "ru_RU" };
const HTML_LANG = { zh: "zh-Hans", en: "en", ru: "ru" };
const URLS = { zh: `${BASE}/`, en: `${BASE}/en/`, ru: `${BASE}/ru/` };
const SWITCH = { zh: "中文", en: "EN", ru: "RU" };
const ORDER = ["zh", "en", "ru"];

function langsHtml(cur) {
  const links = ORDER.map((l) =>
    `      <a href="${l === "zh" ? "/" : "/" + l + "/"}" hreflang="${HTML_LANG[l]}"${l === cur ? ' class="on" aria-current="page"' : ""}>${SWITCH[l]}</a>`
  ).join("\n");
  return `<div class="langs" role="group" aria-label="Language">\n${links}\n    </div>`;
}

function bake(html, dict) {
  // textContent for empty <tag ... data-i18n="KEY"></tag>
  html = html.replace(
    /(<([a-zA-Z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)(<\/\2>)/g,
    (m, open, tag, key, close) => (dict[key] === undefined ? m : open + esc(dict[key]) + close)
  );
  // innerHTML (raw) for data-i18n-html
  html = html.replace(
    /(<([a-zA-Z0-9]+)\b[^>]*\bdata-i18n-html="([^"]+)"[^>]*>)(<\/\2>)/g,
    (m, open, tag, key, close) => (dict[key] === undefined ? m : open + String(dict[key]) + close)
  );
  // placeholder attribute for inputs/textarea
  html = html.replace(
    /(<(?:input|textarea)\b[^>]*\bdata-i18n-ph="([^"]+)"[^>]*?)(>)/g,
    (m, pre, key, end) =>
      dict[key] === undefined || /\splaceholder=/.test(pre) ? m : `${pre} placeholder="${escAttr(dict[key])}"${end}`
  );
  return html;
}

function buildPage(lang) {
  let h = template;
  // root-relative asset paths so subdirectory pages resolve correctly
  h = h.replace(/(\b(?:href|src|poster)=")(img\/|css\/|js\/|krytex-)/g, "$1/$2");
  // <html lang>
  h = h.replace(/<html lang="[^"]*">/, `<html lang="${HTML_LANG[lang]}">`);
  // head meta
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(META[lang][0])}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(META[lang][1])}">`);
  h = h.replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${escAttr(KEYWORDS[lang])}">`);
  h = h.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${URLS[lang]}">\n${HREFLANG}`);
  h = h.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${URLS[lang]}">`);
  h = h.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${OG_LOCALE[lang]}">`);
  const alts = ORDER.filter((l) => l !== lang)
    .map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`)
    .join("\n");
  h = h.replace(/<meta property="og:locale:alternate" content="[^"]*">\s*<meta property="og:locale:alternate" content="[^"]*">/, alts);
  h = h.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escAttr(META[lang][0])}">`);
  h = h.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escAttr(META[lang][1])}">`);
  h = h.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escAttr(META[lang][0])}">`);
  h = h.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escAttr(META[lang][1])}">`);
  // language switcher -> links
  h = h.replace(/<div class="langs"[\s\S]*?<\/div>/, langsHtml(lang));
  // page language for main.js hydration
  h = h.replace(/<script src="\/js\/main\.js" defer><\/script>/, `<script>window.KRX_LANG=${JSON.stringify(lang)};</script>\n<script src="/js/main.js" defer></script>`);
  // bake all translatable text
  h = bake(h, I18N[lang]);
  return h;
}

const targets = { zh: "index.html", en: path.join("en", "index.html"), ru: path.join("ru", "index.html") };
for (const lang of ORDER) {
  const out = path.join(ROOT, targets[lang]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildPage(lang));
  console.log("wrote", targets[lang], "(" + lang + ")");
}
console.log("done");
