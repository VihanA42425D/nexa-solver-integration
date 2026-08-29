import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://docs.vsnexa.com";
const KEY = "7e2f3a91-4c86-4b52-a9d0-1f6c8e3b5a74";
const KEY_FILE = `${KEY}.txt`;
const KEY_LOCATION = `${ORIGIN}/${KEY_FILE}`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const shouldSubmit = process.argv.includes("--submit");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const decodeXml = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'");

const sourceKey = (await readFile(join(ROOT, "docs-site", "docs", KEY_FILE), "utf8")).trim();
assert(sourceKey === KEY, "IndexNow key file does not match its filename");

const sitemap = await readFile(join(ROOT, "docs-site", "site", "sitemap.xml"), "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => decodeXml(match[1].trim()));

assert(urlList.length > 0, "Documentation sitemap has no URLs");
assert(urlList.length <= 10_000, "IndexNow accepts at most 10,000 URLs per request");
assert(new Set(urlList).size === urlList.length, "Documentation sitemap contains duplicate URLs");
for (const value of urlList) {
  const url = new URL(value);
  assert(url.origin === ORIGIN, `IndexNow URL is outside the documentation host: ${value}`);
  assert(url.protocol === "https:", `IndexNow URL is not HTTPS: ${value}`);
}

const payload = {
  host: new URL(ORIGIN).host,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList,
};

if (!shouldSubmit) {
  console.log(`IndexNow validation passed: ${urlList.length} canonical documentation URLs.`);
  process.exit(0);
}

const keyResponse = await fetch(KEY_LOCATION, {
  headers: { "User-Agent": "Nexa-Docs-IndexNow/1.0" },
  redirect: "follow",
});
assert(keyResponse.ok, `Deployed IndexNow key returned HTTP ${keyResponse.status}`);
assert((await keyResponse.text()).trim() === KEY, "Deployed IndexNow key content is invalid");

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": "Nexa-Docs-IndexNow/1.0",
  },
  body: JSON.stringify(payload),
});

assert(
  response.status === 200 || response.status === 202,
  `IndexNow submission failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
);
console.log(`IndexNow accepted ${urlList.length} canonical documentation URLs (HTTP ${response.status}).`);
