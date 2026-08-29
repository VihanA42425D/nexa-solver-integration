import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITEMAP_XML as SOLVER_SITEMAP,
  SOLVER_INDEXNOW_KEY,
  SOLVER_INDEXNOW_KEY_FILE,
} from "../src/worker.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_ORIGIN = "https://docs.vsnexa.com";
const DOCS_KEY = "7e2f3a91-4c86-4b52-a9d0-1f6c8e3b5a74";
const DOCS_KEY_FILE = `${DOCS_KEY}.txt`;
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

const docsSourceKey = (
  await readFile(join(ROOT, "docs-site", "docs", DOCS_KEY_FILE), "utf8")
).trim();
assert(docsSourceKey === DOCS_KEY, "Documentation IndexNow key file is invalid");

const targets = [
  {
    label: "documentation",
    origin: DOCS_ORIGIN,
    key: DOCS_KEY,
    keyFile: DOCS_KEY_FILE,
    sitemap: await readFile(join(ROOT, "docs-site", "site", "sitemap.xml"), "utf8"),
  },
  {
    label: "solver",
    origin: "https://solver.vsnexa.com",
    key: SOLVER_INDEXNOW_KEY,
    keyFile: SOLVER_INDEXNOW_KEY_FILE,
    sitemap: SOLVER_SITEMAP,
  },
].map((target) => {
  assert(/^[A-Za-z0-9-]{8,128}$/.test(target.key), `Invalid ${target.label} IndexNow key`);
  assert(target.keyFile === `${target.key}.txt`, `Invalid ${target.label} IndexNow filename`);
  const urlList = [...target.sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => decodeXml(match[1].trim()));
  assert(urlList.length > 0, `${target.label} sitemap has no URLs`);
  assert(urlList.length <= 10_000, "IndexNow accepts at most 10,000 URLs per request");
  assert(new Set(urlList).size === urlList.length, `${target.label} sitemap has duplicate URLs`);
  for (const value of urlList) {
    const url = new URL(value);
    assert(url.origin === target.origin, `IndexNow URL is outside ${target.label}: ${value}`);
    assert(url.protocol === "https:", `IndexNow URL is not HTTPS: ${value}`);
  }
  return {
    ...target,
    keyLocation: `${target.origin}/${target.keyFile}`,
    urlList,
  };
});

if (!shouldSubmit) {
  console.log(`IndexNow validation passed: ${targets.map(
    (target) => `${target.urlList.length} ${target.label} URLs`,
  ).join(", ")}.`);
  process.exit(0);
}

for (const target of targets) {
  const keyResponse = await fetch(target.keyLocation, {
    headers: { "User-Agent": "Nexa-IndexNow/1.0" },
    redirect: "follow",
  });
  assert(keyResponse.ok, `${target.label} IndexNow key returned HTTP ${keyResponse.status}`);
  assert((await keyResponse.text()).trim() === target.key, `${target.label} IndexNow key is invalid`);

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "Nexa-IndexNow/1.0",
    },
    body: JSON.stringify({
      host: new URL(target.origin).host,
      key: target.key,
      keyLocation: target.keyLocation,
      urlList: target.urlList,
    }),
  });
  assert(
    response.status === 200 || response.status === 202,
    `${target.label} IndexNow submission failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
  );
  console.log(`IndexNow accepted ${target.urlList.length} canonical ${target.label} URLs (HTTP ${response.status}).`);
}
