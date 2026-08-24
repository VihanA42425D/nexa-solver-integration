import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "docs-site", "docs");
const CONCURRENCY = 3;
const TIMEOUT_MS = 20_000;
const LOCAL_ORIGIN = "https://docs.vsnexa.com";

const listFiles = async (directory, files = []) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await listFiles(absolute, files);
    else if (entry.isFile() && /\.(?:md|txt)$/i.test(entry.name)) files.push(absolute);
  }
  return files;
};

const sourceFiles = await listFiles(SOURCE);
const urls = new Set();
for (const path of sourceFiles) {
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/https:\/\/[^\s)<>"'`\[\]]+/g)) {
    const url = match[0].replace(/[.,;:]$/, "");
    if (new URL(url).origin === LOCAL_ORIGIN || url.endsWith(".git")) continue;
    urls.add(url);
  }
}

const pending = [...urls].sort();
const results = [];

const check = async (url) => {
  const request = async (method) => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        accept: "text/html,application/json,text/plain,*/*",
        "user-agent": "Nexa-Docs-Link-Validator/1.0",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (method === "GET") await response.body?.cancel();
    return response;
  };

  try {
    let response = await request("HEAD");
    if ([404, 405, 501].includes(response.status)) response = await request("GET");
    const broken = response.status === 404
      || response.status === 410
      || response.status >= 500;
    return {
      url,
      status: response.status,
      finalUrl: response.url,
      broken,
    };
  } catch (error) {
    return {
      url,
      status: "ERROR",
      finalUrl: url,
      broken: true,
      error: error?.name ?? String(error),
    };
  }
};

const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
  while (pending.length > 0) {
    const url = pending.shift();
    if (url) results.push(await check(url));
  }
});
await Promise.all(workers);

results.sort((left, right) => left.url.localeCompare(right.url));
for (const result of results) {
  const label = result.broken ? "BROKEN" : "OK";
  const redirect = result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : "";
  const error = result.error ? ` (${result.error})` : "";
  console.log(`${label} ${result.status} ${result.url}${redirect}${error}`);
}

const broken = results.filter((result) => result.broken);
if (broken.length > 0) {
  throw new Error(`${broken.length} of ${results.length} external documentation links failed`);
}
console.log(`External documentation links passed: ${results.length} checked.`);
