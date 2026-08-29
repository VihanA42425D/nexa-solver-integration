import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditRepositoryForSecrets } from "./repo-secret-audit.mjs";
import indexNowConfig from "../config/indexnow.json" with { type: "json" };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "docs-site", "docs");
const SITE = join(ROOT, "docs-site", "site");
const ORIGIN = "https://docs.vsnexa.com";
const INDEXNOW_KEY = indexNowConfig.key;
const INDEXNOW_KEY_FILE = indexNowConfig.keyFile;

const requiredRoutes = [
  ["/", "index.html"],
  ["/quick-start/", "quick-start/index.html"],
  ["/solver-integration/", "solver-integration/index.html"],
  ["/api/", "api/index.html"],
  ["/networks-contracts/", "networks-contracts/index.html"],
  ["/sdks/", "sdks/index.html"],
  ["/standards/", "standards/index.html"],
  ["/indexing/", "indexing/index.html"],
  ["/verification-security/", "verification-security/index.html"],
  ["/resources/", "resources/index.html"],
  ["/contact/", "contact/index.html"],
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const firstMatch = (source, pattern, message) => {
  const match = source.match(pattern);
  assert(match, message);
  return match[1];
};

const attribute = (tag, name, message) => {
  const pattern = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);
  assert(match, message);
  return match[1] ?? match[2] ?? match[3];
};

const tagWithAttribute = (html, tagName, name, value, message) => {
  const tags = html.match(new RegExp(`<${tagName}\\s+[^>]*>`, "gi")) ?? [];
  const tag = tags.find((candidate) => {
    try { return attribute(candidate, name, "") === value; } catch { return false; }
  });
  assert(tag, message);
  return tag;
};

const pageTargetForPath = (pathname) => {
  const decoded = decodeURIComponent(pathname);
  if (decoded.endsWith("/")) return join(SITE, decoded.slice(1), "index.html");
  if (extname(decoded)) return join(SITE, decoded.slice(1));
  return join(SITE, decoded.slice(1), "index.html");
};

const listFiles = async (directory, files = []) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await listFiles(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
};
const forbiddenInternalCopy = [
  /receiving mailbox/i,
  /ticket database/i,
  /Cloudflare Worker/i,
  /destination address to the browser/i,
  /Nexa runtime (?:RPC|database|worker)/i,
  /LISTEN\/NOTIFY/i,
  /private infrastructure/i,
  /does not self-host/i,
  /background poll(?:er|ing)/i,
];


const titles = new Set();
const descriptions = new Set();
const canonicals = new Set();

for (const [route, relativePath] of requiredRoutes) {
  const absolutePath = join(SITE, relativePath);
  assert(await exists(absolutePath), `Missing required route ${route}`);
  const html = await readFile(absolutePath, "utf8");

  const title = firstMatch(html, /<title>([^<]+)<\/title>/i, `Missing title: ${route}`);
  const descriptionTag = tagWithAttribute(
    html, "meta", "name", "description",
    `Missing meta description: ${route}`,
  );
  const description = attribute(descriptionTag, "content", `Missing description content: ${route}`);
  assert(title.length >= 20 && title.length <= 60, `Page title must be 20-60 characters: ${route} (${title.length})`);
  assert(
    description.length >= 90 && description.length <= 155,
    `Meta description must be 90-155 characters: ${route} (${description.length})`,
  );
  assert(Buffer.byteLength(html) <= 64 * 1024, `HTML exceeds 64 KiB: ${route}`);
  assert(
    (html.match(/<h1(?:\s|>)/gi) ?? []).length === 1,
    `Page must expose exactly one H1: ${route}`,
  );
  const articleHtml = firstMatch(
    html,
    /<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i,
    `Missing article content: ${route}`,
  );
  const articleWords = articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  assert(
    articleWords >= 100 && articleWords <= 1_200,
    `Visible article content must be 100-1,200 words: ${route} (${articleWords})`,
  );
  for (const match of articleHtml.matchAll(/<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi)) {
    const heading = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert(heading && heading.length <= 80, `H${match[1]} exceeds 80 characters: ${route}`);
  }
  const robotsTag = tagWithAttribute(
    html, "meta", "name", "robots",
    `Missing robots meta tag: ${route}`,
  );
  assert(attribute(robotsTag, "content", "") === "index,follow", `Page is not explicitly indexable: ${route}`);
  const canonicalTag = tagWithAttribute(
    html, "link", "rel", "canonical",
    `Missing canonical URL: ${route}`,
  );
  const canonical = attribute(canonicalTag, "href", `Missing canonical href: ${route}`);
  const manifestLink = tagWithAttribute(
    html, "link", "href", "https://solver.vsnexa.com/.well-known/nexa-solver.json",
    `Missing solver manifest discovery link: ${route}`,
  );
  assert(
    attribute(manifestLink, "rel", "") === "alternate"
      && attribute(manifestLink, "type", "") === "application/json",
    `Invalid solver manifest discovery link: ${route}`,
  );
  const serviceDescLink = tagWithAttribute(
    html, "link", "rel", "service-desc",
    `Missing OpenAPI service-desc link: ${route}`,
  );
  assert(
    attribute(serviceDescLink, "href", "") === "https://solver.vsnexa.com/openapi.json",
    `Invalid OpenAPI service-desc link: ${route}`,
  );

  assert(!titles.has(title), `Duplicate page title: ${title}`);
  assert(!descriptions.has(description), `Duplicate meta description: ${description}`);
  assert(!canonicals.has(canonical), `Duplicate canonical URL: ${canonical}`);
  titles.add(title);
  descriptions.add(description);
  canonicals.add(canonical);

  assert(canonical === `${ORIGIN}${route}`, `Unexpected canonical for ${route}: ${canonical}`);
  const openGraph = Object.fromEntries(
    ["og:title", "og:description", "og:url"].map((property) => {
      const tag = tagWithAttribute(html, "meta", "property", property, `Missing Open Graph ${property}: ${route}`);
      return [property, attribute(tag, "content", `Missing Open Graph content: ${route}`)];
    }),
  );
  assert(openGraph["og:title"] === title.replace(/ - Nexa V6 Docs$/, ""), `Open Graph title drift: ${route}`);
  assert(openGraph["og:description"] === description, `Open Graph description drift: ${route}`);
  assert(openGraph["og:url"] === canonical, `Open Graph canonical drift: ${route}`);
  tagWithAttribute(html, "meta", "name", "twitter:card", `Missing Twitter card: ${route}`);
  for (const [name, expected] of [
    ["twitter:title", openGraph["og:title"]],
    ["twitter:description", description],
  ]) {
    const tag = tagWithAttribute(html, "meta", "name", name, `Missing ${name}: ${route}`);
    assert(attribute(tag, "content", "") === expected, `${name} drift: ${route}`);
  }
  const searchDialog = tagWithAttribute(html, "div", "role", "dialog", `Missing search dialog: ${route}`);
  assert(attribute(searchDialog, "aria-label", "").trim(), `Search dialog lacks an accessible name: ${route}`);

  const jsonLd = firstMatch(
    html,
    /<script\s+type=(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)>([\s\S]*?)<\/script>/i,
    `Missing JSON-LD: ${route}`,
  );
  assert(jsonLd.length <= 2_500, `JSON-LD exceeds 2,500 characters: ${route}`);
  const structuredData = JSON.parse(jsonLd);
  const types = new Set((structuredData["@graph"] ?? []).map((entry) => entry["@type"]));
  const requiredTypes = route === "/"
    ? ["WebSite", "SoftwareSourceCode", "WebAPI"]
    : ["/api/", "/resources/"].includes(route)
      ? ["WebSite", "TechArticle", "SoftwareSourceCode", "WebAPI", "BreadcrumbList"]
      : ["WebSite", "TechArticle", "BreadcrumbList"];
  for (const type of requiredTypes) {
    assert(types.has(type), `Missing JSON-LD ${type}: ${route}`);
  }

  const externalScripts = [...html.matchAll(
    /<script\s+[^>]*src=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
  )].map((match) => match[1] ?? match[2] ?? match[3])
    .filter((src) => /^https?:\/\//i.test(src));
  if (route === "/contact/") {
    assert(
      externalScripts.length === 1
        && externalScripts[0] === "https://challenges.cloudflare.com/turnstile/v0/api.js",
      "Contact page must load only the canonical Cloudflare Turnstile script",
    );
  } else {
    assert(externalScripts.length === 0, `External JavaScript is not allowed: ${route}`);
  }
}

const htmlFiles = (await listFiles(SITE)).filter((path) => path.endsWith(".html"));
for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  const currentRoute = relative(SITE, htmlPath).replaceAll("\\", "/");
  assert(!/admin@vsnexa\.com/i.test(html), `Receiving mailbox exposed in ${currentRoute}`);
  for (const pattern of forbiddenInternalCopy) {
    assert(!pattern.test(html), `Internal implementation copy exposed in ${currentRoute}: ${pattern}`);
  }
  const canonical = currentRoute === "index.html"
    ? `${ORIGIN}/`
    : `${ORIGIN}/${currentRoute.replace(/index\.html$/, "")}`;
  const hrefPattern = /href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1] ?? match[2] ?? match[3];
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    const url = new URL(href, canonical);
    if (url.origin !== ORIGIN) {
      assert(url.protocol === "https:", `Non-HTTPS external link in ${currentRoute}: ${href}`);
      assert(!/[\u2026{}]/u.test(href), `Placeholder external link in ${currentRoute}: ${href}`);
      continue;
    }
    const target = pageTargetForPath(url.pathname);
    assert(await exists(target), `Broken internal link in ${currentRoute}: ${href}`);
  }
}

const notFoundHtml = await readFile(join(SITE, "404.html"), "utf8");
const notFoundRobots = tagWithAttribute(
  notFoundHtml, "meta", "name", "robots",
  "404 page lacks robots metadata",
);
assert(
  attribute(notFoundRobots, "content", "") === "noindex,nofollow",
  "404 page must be noindex,nofollow",
);

const robots = await readFile(join(SITE, "robots.txt"), "utf8");
assert(/^User-agent: \*/m.test(robots), "robots.txt lacks a global crawler rule");
assert(/^Allow: \/$/m.test(robots), "robots.txt does not allow the documentation site");
assert(robots.includes(`${ORIGIN}/sitemap.xml`), "robots.txt has the wrong sitemap URL");
assert(
  robots.includes("https://solver.vsnexa.com/sitemap.xml"),
  "robots.txt lacks the canonical solver sitemap",
);

const sitemap = await readFile(join(SITE, "sitemap.xml"), "utf8");
assert(Buffer.byteLength(sitemap) <= 32 * 1024, "Sitemap exceeds the 32 KiB project budget");
for (const [route] of requiredRoutes) {
  assert(sitemap.includes(`<loc>${ORIGIN}${route}</loc>`), `Sitemap lacks ${route}`);
}

const llms = await readFile(join(SITE, "llms.txt"), "utf8");
const llmsFull = await readFile(join(SITE, "llms-full.txt"), "utf8");
assert(Buffer.byteLength(llms) <= 4 * 1024, "llms.txt exceeds the 4 KiB project budget");
assert(Buffer.byteLength(llmsFull) <= 8 * 1024, "llms-full.txt exceeds the 8 KiB project budget");
for (const [route] of requiredRoutes) {
  assert(llms.includes(`${ORIGIN}${route}`), `llms.txt lacks ${route}`);
}
assert(llms.includes("https://solver.vsnexa.com/openapi.json"), "llms.txt lacks canonical OpenAPI");
assert(llmsFull.includes("exact: one Bot source transaction plus one Nexa destination transaction"), "llms-full.txt lacks exact 1+1 context");

for (const file of ["404.html", "search/search_index.json", "_headers", "_redirects", "assets/openapi.json"]) {
  assert(await exists(join(SITE, file)), `Missing built static artifact: ${file}`);
}

const indexNowSourceKey = (await readFile(join(SOURCE, INDEXNOW_KEY_FILE), "utf8")).trim();
const indexNowBuiltKey = (await readFile(join(SITE, INDEXNOW_KEY_FILE), "utf8")).trim();
assert(/^[A-Za-z0-9-]{8,128}$/.test(INDEXNOW_KEY), "Canonical IndexNow key is invalid");
assert(INDEXNOW_KEY_FILE === `${INDEXNOW_KEY}.txt`, "Canonical IndexNow filename is invalid");
assert(
  indexNowConfig.hosts.length === 2
    && indexNowConfig.hosts.includes("docs.vsnexa.com")
    && indexNowConfig.hosts.includes("solver.vsnexa.com"),
  "Canonical IndexNow host allowlist is invalid",
);
assert(indexNowSourceKey === INDEXNOW_KEY, "IndexNow source key file is invalid");
assert(indexNowBuiltKey === INDEXNOW_KEY, "IndexNow key file was not copied to the site root");

const headers = await readFile(join(SITE, "_headers"), "utf8");
for (const header of [
  "Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options",
  "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security", "X-Robots-Tag",
]) {
  assert(headers.includes(`${header}:`), `Missing security header: ${header}`);
}
assert(!headers.includes("X-Robots-Tag: all"), "Global X-Robots-Tag must not index crawler-control files");
assert(
  headers.includes(`/${INDEXNOW_KEY_FILE}\n  X-Robots-Tag: noindex, nofollow`),
  "IndexNow ownership file must be noindex,nofollow",
);
for (const path of [
  "/robots.txt", "/sitemap.xml", "/llms.txt", "/llms-full.txt", "/assets/openapi.json",
]) {
  assert(
    headers.includes(`${path}\n  X-Robots-Tag: noindex, follow`),
    `Missing auxiliary noindex rule: ${path}`,
  );
}
assert(
  headers.includes("https://:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow")
    && headers.includes("https://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow"),
  "Cloudflare Pages preview hosts must be noindex",
);
assert(
  headers.includes('rel="service-desc"')
    && headers.includes("https://solver.vsnexa.com/openapi.json"),
  "Documentation headers lack canonical OpenAPI service discovery",
);
assert(
  headers.includes("https://solver.vsnexa.com/.well-known/nexa-solver.json"),
  "Documentation headers lack the canonical solver manifest",
);

const redirects = await readFile(join(SITE, "_redirects"), "utf8");
for (const [source, target] of [
  ["/openapi.json", "https://solver.vsnexa.com/openapi.json"],
  ["/.well-known/nexa-solver.json", "https://solver.vsnexa.com/.well-known/nexa-solver.json"],
  ["/.well-known/nexa-onchain-discovery.json", "https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json"],
  ["/.well-known/nexa-standards.json", "https://solver.vsnexa.com/.well-known/nexa-standards.json"],
  ["/api/v6/solver-discovery", "https://solver.vsnexa.com/api/v6/solver-discovery"],
]) {
  assert(
    redirects.includes(`${source} ${target} 301`),
    `Missing canonical documentation redirect: ${source}`,
  );
}

const canonicalOpenApi = await readFile(join(ROOT, "openapi", "openapi.json"));
const docsOpenApi = await readFile(join(SITE, "assets", "openapi.json"));
assert(canonicalOpenApi.equals(docsOpenApi), "Built documentation OpenAPI diverges from canonical source");

const contactHtml = await readFile(join(SITE, "contact", "index.html"), "utf8");
const contactScript = await readFile(join(SITE, "assets", "javascripts", "contact.8ac5ae43aae9.js"), "utf8");
const ticketWorker = await readFile(join(ROOT, "docs-ticket-worker", "src", "worker.mjs"), "utf8");
const ticketWorkerConfig = await readFile(join(ROOT, "docs-ticket-worker", "wrangler.jsonc"), "utf8");
assert(/\bid=(?:"nexa-contact-form"|nexa-contact-form)(?:\s|>)/.test(contactHtml), "Contact page lacks the ticket form");
assert(/\bclass=(?:"cf-turnstile"|cf-turnstile)(?:\s|>)/.test(contactHtml), "Contact page lacks Turnstile");
assert(/\bdata-action=(?:"docs_contact"|docs_contact)(?:\s|>)/.test(contactHtml), "Contact page has the wrong Turnstile action");
assert(/\bdata-sitekey=(?:"0x4A[A-Za-z0-9_-]+"|0x4A[A-Za-z0-9_-]+)(?:\s|>)/.test(contactHtml), "Contact page lacks a production Turnstile sitekey");
assert(contactScript.includes('fetch("/api/tickets"'), "Contact script does not use the same-origin ticket endpoint");
assert(contactScript.includes("cf-turnstile-response"), "Contact script does not submit the Turnstile token");
assert(!contactScript.includes("mailto:"), "Contact script exposes an email draft path");
assert(!/admin@vsnexa\.com/i.test(contactHtml + contactScript), "Contact page exposes the receiving mailbox");
assert(!/https?:\/\/(?:formspree|formspark|web3forms|basin)\./i.test(contactHtml + contactScript), "Contact form uses an external form processor");
assert(ticketWorker.includes('request.headers.get("Origin") !== ALLOWED_ORIGIN'), "Ticket Worker lacks strict same-origin enforcement");
assert(ticketWorker.includes("MAX_BODY_BYTES = 8_192"), "Ticket Worker lacks a body-size limit");
assert(ticketWorker.includes("TICKET_RATE_LIMITER"), "Ticket Worker lacks rate limiting");
assert(ticketWorker.includes("https://challenges.cloudflare.com/turnstile/v0/siteverify"), "Ticket Worker lacks server-side Turnstile verification");
assert(ticketWorker.includes('result.hostname !== "docs.vsnexa.com"'), "Ticket Worker does not pin the Turnstile hostname");
assert(ticketWorker.includes("env.TICKET_RECIPIENT"), "Ticket Worker does not read the recipient from a secret");
assert(!/admin@vsnexa\.com/i.test(ticketWorker + ticketWorkerConfig), "Ticket Worker source exposes the receiving mailbox");
assert(ticketWorkerConfig.includes('"pattern": "docs.vsnexa.com/api/tickets"'), "Ticket Worker route is not hostname scoped");
assert(ticketWorkerConfig.includes('"allowed_sender_addresses"'), "Ticket Worker email binding lacks a sender restriction");
assert(headers.includes("https://challenges.cloudflare.com"), "CSP does not allow canonical Turnstile resources");
assert(headers.includes("frame-src https://challenges.cloudflare.com"), "CSP does not restrict Turnstile frames");
assert(headers.includes("form-action 'self';"), "CSP does not restrict form actions to self");
assert(!headers.includes("mailto:"), "CSP retains an address-exposing mailto path");

const forbiddenPublicTopics = [
  "capital allocation", "capital sizing", "dynamic notional", "route profitability",
  "route ranking", "route scoring", "internal rebalancing", "treasury structure",
  "operational thresholds", "internal risk parameters", "backend service topology",
  "admin controls", "engine configuration", "proprietary algorithms",
  "proprietary heuristics", "private monitoring",
];
const publicSourceFiles = (await listFiles(SOURCE)).filter((path) => /\.(?:md|txt|html)$/i.test(path));
for (const sourcePath of publicSourceFiles) {
  const source = (await readFile(sourcePath, "utf8")).toLowerCase();
  for (const topic of forbiddenPublicTopics) {
    assert(!source.includes(topic), `Confidential topic '${topic}' found in ${relative(ROOT, sourcePath)}`);
  }
}

const scannedFiles = await auditRepositoryForSecrets(ROOT);
console.log(`Documentation validation passed: ${requiredRoutes.length} routes, ${htmlFiles.length} HTML files, ${scannedFiles} files secret-scanned.`);
