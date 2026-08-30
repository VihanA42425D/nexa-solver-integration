import solverManifest from "../public/.well-known/nexa-solver.json" with { type: "json" };
import onchainDiscovery from "../public/.well-known/nexa-onchain-discovery.json" with { type: "json" };
import standardsManifest from "../public/.well-known/nexa-standards.json" with { type: "json" };
import openApiDocument from "../openapi/openapi.json" with { type: "json" };
import indexNowConfig from "../config/indexnow.json" with { type: "json" };

const SOLVER_HOST = "solver.vsnexa.com";
const APP_HOST = "vsnexa.com";
const SOLVER_BASE_URL = `https://${SOLVER_HOST}`;
const SOLVER_INDEXNOW_KEY = indexNowConfig.key;
const SOLVER_INDEXNOW_KEY_FILE = indexNowConfig.keyFile;
const SOLVER_INDEXNOW_PATH = `/${SOLVER_INDEXNOW_KEY_FILE}`;

if (!/^[A-Za-z0-9-]{8,128}$/.test(SOLVER_INDEXNOW_KEY)
    || SOLVER_INDEXNOW_KEY_FILE !== `${SOLVER_INDEXNOW_KEY}.txt`
    || !indexNowConfig.hosts.includes(SOLVER_HOST)) {
  throw new Error("Invalid canonical IndexNow configuration");
}

const SOLVER_MANIFEST_URL = `${SOLVER_BASE_URL}/.well-known/nexa-solver.json`;
const OPENAPI_URL = `${SOLVER_BASE_URL}/openapi.json`;
const SOLVER_DOCS_URL = "https://docs.vsnexa.com/";
const SOLVER_ROOT_TITLE = "Nexa V6 Solver API & Discovery";
const SOLVER_ROOT_DESCRIPTION = "Canonical Nexa Mainnet V6 solver discovery for signed routes, execution permits, ERC-7683 resolution, OpenAPI, and on-chain deployment data.";
const CRAWLER_LINK_HEADER = [
  `<${SOLVER_MANIFEST_URL}>; rel="alternate"; type="application/json"; title="Nexa V6 Solver Manifest"`,
  `<${OPENAPI_URL}>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  `<${SOLVER_DOCS_URL}api/>; rel="describedby"; type="text/html"`,
].join(", ");

const EDGE_STATIC_DISCOVERY_PATHS = Object.freeze([
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  SOLVER_INDEXNOW_PATH,
]);

const ORIGIN_STABLE_DISCOVERY_PATHS = Object.freeze([
  "/.well-known/nexa-solver.json",
  "/.well-known/nexa-onchain-discovery.json",
  "/.well-known/nexa-standards.json",
  "/openapi.json",
  "/api/v6/solver-discovery",
]);

const LONG_LIVED_ORIGIN_DISCOVERY_PATHS = Object.freeze([
  "/.well-known/nexa-onchain-discovery.json",
  "/.well-known/nexa-standards.json",
  "/openapi.json",
]);

const SOLVER_ROOT_STRUCTURED_DATA = Object.freeze({
  "@context": "https://schema.org",
  "@type": "WebAPI",
  "@id": `${SOLVER_BASE_URL}/#api`,
  name: SOLVER_ROOT_TITLE,
  description: SOLVER_ROOT_DESCRIPTION,
  url: `${SOLVER_BASE_URL}/`,
  documentation: `${SOLVER_DOCS_URL}api/`,
  serviceType: "Intra-chain and cross-chain solver discovery and execution API",
});

const ROOT_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${SOLVER_ROOT_TITLE}</title><meta name="description" content="${SOLVER_ROOT_DESCRIPTION}"><meta name="robots" content="index,follow"><link rel="canonical" href="${SOLVER_BASE_URL}/"><link rel="alternate" type="application/json" title="Nexa V6 Solver Manifest" href="${SOLVER_MANIFEST_URL}"><link rel="service-desc" type="application/vnd.oai.openapi+json;version=3.1" title="Nexa V6 OpenAPI" href="${OPENAPI_URL}"><link rel="alternate" type="text/plain" title="Nexa V6 LLM Index" href="${SOLVER_BASE_URL}/llms.txt"><meta property="og:type" content="website"><meta property="og:title" content="${SOLVER_ROOT_TITLE}"><meta property="og:description" content="${SOLVER_ROOT_DESCRIPTION}"><meta property="og:url" content="${SOLVER_BASE_URL}/"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${SOLVER_ROOT_TITLE}"><meta name="twitter:description" content="${SOLVER_ROOT_DESCRIPTION}"><script type="application/ld+json">${JSON.stringify(SOLVER_ROOT_STRUCTURED_DATA)}</script><style>body{margin:0;background:#f6f8fb;color:#172033;font:16px/1.55 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:48px 24px}h1{font-size:2rem}h2{margin-top:2rem}a{color:#075ac8}li{margin:.55rem 0}</style></head><body><main><h1>${SOLVER_ROOT_TITLE}</h1><p>${SOLVER_ROOT_DESCRIPTION}</p><section><h2>Discovery artifacts</h2><ul><li><a href="${SOLVER_MANIFEST_URL}">Solver manifest</a> - entry point, networks, capabilities, and endpoint map.</li><li><a href="${SOLVER_BASE_URL}/.well-known/nexa-onchain-discovery.json">On-chain discovery</a> - canonical deployment addresses, code hashes, and scanner hints.</li><li><a href="${SOLVER_BASE_URL}/.well-known/nexa-standards.json">Standards manifest</a> - ERC-7683 and OIF capability levels.</li><li><a href="${OPENAPI_URL}">OpenAPI 3.1</a> - typed HTTP and SSE operations.</li><li><a href="${SOLVER_BASE_URL}/api/v6/solver-discovery">Discovery API</a> - API-path projection of the solver manifest.</li></ul></section><section><h2>Integrate</h2><p>Use the <a href="${SOLVER_DOCS_URL}quick-start/">quick start</a> and <a href="${SOLVER_DOCS_URL}api/">API guide</a>, or inspect the <a href="https://github.com/VihanA42425D/nexa-solver-integration">public integration repository</a>. Execution remains exactly one Bot source transaction plus one Nexa destination transaction.</p></section></main></body></html>\n`;

const ROBOTS_TEXT = `User-agent: *\nAllow: /\nSitemap: ${SOLVER_BASE_URL}/sitemap.xml\n`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SOLVER_BASE_URL}/</loc></url>\n  <url><loc>${SOLVER_BASE_URL}/.well-known/nexa-solver.json</loc></url>\n  <url><loc>${SOLVER_BASE_URL}/.well-known/nexa-onchain-discovery.json</loc></url>\n  <url><loc>${SOLVER_BASE_URL}/.well-known/nexa-standards.json</loc></url>\n  <url><loc>${SOLVER_BASE_URL}/openapi.json</loc></url>\n  <url><loc>${SOLVER_BASE_URL}/api/v6/solver-discovery</loc></url>\n</urlset>\n`;

const LLMS_TEXT = `# Nexa V6\n\nNexa V6 exposes a machine-readable solver integration surface.\n\n- Solver discovery manifest: ${SOLVER_MANIFEST_URL}\n- On-chain discovery: ${SOLVER_BASE_URL}/.well-known/nexa-onchain-discovery.json\n- Standards: ${SOLVER_BASE_URL}/.well-known/nexa-standards.json\n- OpenAPI: ${OPENAPI_URL}\n- Signed Feed: ${SOLVER_BASE_URL}/api/v6/solver-feed\n- Public integration repository: https://github.com/VihanA42425D/nexa-solver-integration\n- Graph Base index: https://api.studio.thegraph.com/query/1748073/nexa-v-6-base/1.0.0\n- Graph BSC index: https://api.studio.thegraph.com/query/1748073/nexa-v-6-bsc/1.0.0\n- Substreams Base: https://substreams.dev/packages/nexa-v6-indexing-base/v1.0.0\n- Substreams BSC: https://substreams.dev/packages/nexa-v6-indexing-bsc/v1.0.0\n- Substreams HyperEVM: https://substreams.dev/packages/nexa-v6-indexing-hyper-evm/v1.0.0\n\nThe Signed Feed is authoritative for live route terms. The Execution Permit is the final execution authority. Graph and Substreams are non-authoritative indexes.\n`;

const EDGE_STATIC_DISCOVERY = Object.freeze({
  "/": Object.freeze({ body: ROOT_HTML, contentType: "text/html; charset=utf-8" }),
  "/robots.txt": Object.freeze({ body: ROBOTS_TEXT, contentType: "text/plain; charset=utf-8", indexable: false }),
  "/sitemap.xml": Object.freeze({ body: SITEMAP_XML, contentType: "application/xml; charset=utf-8", indexable: false }),
  "/llms.txt": Object.freeze({ body: LLMS_TEXT, contentType: "text/plain; charset=utf-8", indexable: false }),
  [SOLVER_INDEXNOW_PATH]: Object.freeze({
    body: SOLVER_INDEXNOW_KEY,
    contentType: "text/plain; charset=utf-8",
    indexable: false,
    follow: false,
  }),
});

const CANONICAL_V6_SOLVER_DISCOVERY_BODY = JSON.stringify(solverManifest);
const EDGE_STABLE_DISCOVERY = Object.freeze({
  "/.well-known/nexa-solver.json": Object.freeze({
    body: CANONICAL_V6_SOLVER_DISCOVERY_BODY,
    longLived: false,
  }),
  "/.well-known/nexa-onchain-discovery.json": Object.freeze({
    body: JSON.stringify(onchainDiscovery),
    longLived: true,
  }),
  "/.well-known/nexa-standards.json": Object.freeze({
    body: JSON.stringify(standardsManifest),
    longLived: true,
  }),
  "/openapi.json": Object.freeze({
    body: JSON.stringify(openApiDocument),
    longLived: true,
  }),
  "/api/v6/solver-discovery": Object.freeze({
    body: CANONICAL_V6_SOLVER_DISCOVERY_BODY,
    longLived: false,
  }),
});

const PUBLIC_ROUTES = Object.freeze([
  Object.freeze({ method: "GET", pattern: /^\/\.well-known\/nexa-solver\.json$/ }),
  Object.freeze({ method: "GET", pattern: /^\/\.well-known\/nexa-onchain-discovery\.json$/ }),
  Object.freeze({ method: "GET", pattern: /^\/\.well-known\/nexa-standards\.json$/ }),
  Object.freeze({ method: "GET", pattern: /^\/openapi\.json$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/v6\/solver-discovery$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/v6\/solver-feed$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/v6\/solver-feed\/events$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/v6\/routes\/0x[0-9a-fA-F]{64}$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/v6\/execution-permits\/request-message$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/v6\/execution-permits$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/v6\/execution-permits\/0x[0-9a-fA-F]{64}$/ }),
]);

const EDGE_HEADERS = Object.freeze([
  "x-nexa-v6-solver-fingerprint",
  "x-nexa-v6-edge-epoch",
  "x-nexa-v6-edge-timestamp",
  "x-nexa-v6-edge-signature",
]);

const APP_ACCESS_HEADERS = Object.freeze([
  "x-nexa-app-access-email",
  "x-nexa-app-access-timestamp",
  "x-nexa-app-access-signature",
]);

const accessJwksByIssuer = new Map();
const ACCESS_JWKS_TTL_MS = 60 * 60 * 1_000;

function withSolverCors(headers = new Headers()) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type,Idempotency-Key");
  headers.set("access-control-max-age", "86400");
  headers.set("vary", "Origin");
  return headers;
}

function json(status, body, options = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (options.solverCors) withSolverCors(headers);
  return new Response(JSON.stringify(body), { status, headers });
}

function isEdgeStaticDiscoveryRoute(method, pathname) {
  return ["GET", "HEAD"].includes(method) && EDGE_STATIC_DISCOVERY_PATHS.includes(pathname);
}

function withCrawlerDiscoveryHeaders(headers, canonicalUrl = "") {
  headers.set("x-robots-tag", "index, follow");
  headers.set(
    "link",
    canonicalUrl
      ? `<${canonicalUrl}>; rel="canonical", ${CRAWLER_LINK_HEADER}`
      : CRAWLER_LINK_HEADER,
  );
  return headers;
}

function edgeStaticDiscoveryResponse(request, pathname) {
  if (!isEdgeStaticDiscoveryRoute(request.method, pathname)) return null;
  const artifact = EDGE_STATIC_DISCOVERY[pathname];
  const headers = withSolverCors(new Headers({
    "content-type": artifact.contentType,
    "cache-control": "public, max-age=3600, stale-while-revalidate=300, stale-if-error=86400",
    "cloudflare-cdn-cache-control": "public, max-age=86400, stale-while-revalidate=3600, stale-if-error=86400",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  }));
  if (artifact.indexable === false) {
    headers.set("x-robots-tag", artifact.follow === false ? "noindex, nofollow" : "noindex, follow");
  } else {
    withCrawlerDiscoveryHeaders(headers);
  }
  return new Response(request.method === "HEAD" ? null : artifact.body, { status: 200, headers });
}

function edgeStableDiscoveryResponse(request, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const artifact = EDGE_STABLE_DISCOVERY[pathname];
  if (!artifact) return null;
  const headers = withCrawlerDiscoveryHeaders(withSolverCors(new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": artifact.longLived
      ? "public, max-age=300, stale-while-revalidate=3600"
      : "public, max-age=60",
    "cloudflare-cdn-cache-control": artifact.longLived
      ? "public, max-age=86400, stale-while-revalidate=3600, stale-if-error=86400"
      : "public, max-age=60, stale-while-revalidate=60, stale-if-error=300",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  })), `${SOLVER_BASE_URL}${pathname}`);
  return new Response(request.method === "HEAD" ? null : artifact.body, {
    status: 200,
    headers,
  });
}

function decorateOriginDiscoveryResponse(response, pathname) {
  if (response.status !== 200 || !ORIGIN_STABLE_DISCOVERY_PATHS.includes(pathname)) return response;
  const headers = withCrawlerDiscoveryHeaders(
    new Headers(response.headers),
    `${SOLVER_BASE_URL}${pathname}`,
  );
  headers.set(
    "cloudflare-cdn-cache-control",
    LONG_LIVED_ORIGIN_DISCOVERY_PATHS.includes(pathname)
      ? "public, max-age=86400, stale-while-revalidate=3600, stale-if-error=86400"
      : "public, max-age=60, stale-while-revalidate=60, stale-if-error=300",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isPublicRoute(method, pathname) {
  if (method === "OPTIONS") {
    return PUBLIC_ROUTES.some((route) => route.pattern.test(pathname));
  }
  return PUBLIC_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function normalizeAccessIssuer(value) {
  try {
    const issuer = new URL(String(value ?? "").trim());
    if (issuer.protocol !== "https:" || issuer.username || issuer.password
        || issuer.search || issuer.hash || issuer.pathname !== "/"
        || !issuer.hostname.endsWith(".cloudflareaccess.com")) return "";
    return issuer.origin;
  } catch {
    return "";
  }
}

async function accessJwks(issuer, options = {}, forceRefresh = false) {
  const nowMs = Date.now();
  const cached = accessJwksByIssuer.get(issuer);
  if (!forceRefresh && cached && cached.expiresAtMs > nowMs) return cached.promise;
  const fetchImpl = options.accessJwksFetchImpl ?? fetch;
  const promise = (async () => {
    const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("ACCESS_JWKS_UNAVAILABLE");
    const payload = await response.json();
    if (!Array.isArray(payload?.keys) || payload.keys.length === 0) {
      throw new Error("ACCESS_JWKS_INVALID");
    }
    return payload.keys;
  })();
  accessJwksByIssuer.set(issuer, { expiresAtMs: nowMs + ACCESS_JWKS_TTL_MS, promise });
  try {
    return await promise;
  } catch (error) {
    if (accessJwksByIssuer.get(issuer)?.promise === promise) accessJwksByIssuer.delete(issuer);
    throw error;
  }
}

function hasAccessAudience(payload, expectedAudience) {
  const audiences = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud];
  return audiences.some((audience) => String(audience ?? "") === expectedAudience);
}

async function verifiedAccessEmailFromAssertion(
  request,
  env,
  options = {},
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const assertion = String(request.headers.get("cf-access-jwt-assertion") ?? "").trim();
  const issuer = normalizeAccessIssuer(env.NEXA_APP_ACCESS_ISSUER);
  const expectedAudience = String(env.NEXA_APP_ACCESS_AUD ?? "").trim();
  const parts = assertion.split(".");
  if (!issuer || !expectedAudience || parts.length !== 3 || parts.some((part) => !part)) return "";
  try {
    const header = decodeJwtJson(parts[0]);
    const payload = decodeJwtJson(parts[1]);
    if (header?.alg !== "RS256" || !header?.kid
        || normalizeAccessIssuer(payload?.iss) !== issuer
        || !hasAccessAudience(payload, expectedAudience)) return "";
    const issuedAt = Number(payload?.iat);
    const notBefore = payload?.nbf == null ? null : Number(payload.nbf);
    const expiresAt = Number(payload?.exp);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)
        || issuedAt > nowSeconds + 30 || expiresAt <= nowSeconds
        || (notBefore != null && (!Number.isFinite(notBefore) || notBefore > nowSeconds + 30))) return "";

    let keys = await accessJwks(issuer, options);
    let jwk = keys.find((candidate) => candidate?.kid === header.kid && candidate?.kty === "RSA");
    if (!jwk) {
      // A new kid is evidence of key rotation. A bad signature for an already
      // known key is not, and must not create another network fetch.
      keys = await accessJwks(issuer, options, true);
      jwk = keys.find((candidate) => candidate?.kid === header.kid && candidate?.kty === "RSA");
    }
    if (!jwk) return "";
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!verified) return "";
    return String(payload?.email ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function trustedAccessEmail(request, env, options, nowSeconds) {
  const access = options.executionContext?.access;
  if (typeof access?.getIdentity === "function") {
    try {
      const identity = await access.getIdentity();
      const email = String(identity?.email ?? "").trim().toLowerCase();
      if (email) return email;
    } catch {}
  }
  const directEmail = String(request.headers.get("cf-access-authenticated-user-email") ?? "")
    .trim()
    .toLowerCase();
  if (directEmail) return directEmail;
  return verifiedAccessEmailFromAssertion(request, env, options, nowSeconds);
}

async function attachTrustedEdgeIdentity(headers, request, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  for (const name of EDGE_HEADERS) headers.delete(name);
  const secret = String(env.NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET ?? "");
  if (secret.length < 32) return;
  const url = new URL(request.url);
  const epoch = Math.floor(nowSeconds / 86_400);
  const ip = String(request.headers.get("cf-connecting-ip") ?? "unknown").trim().toLowerCase();
  const agent = String(request.headers.get("user-agent") ?? "unknown").trim().toLowerCase();
  const fingerprint = await hmacHex(secret, `solver\n${epoch}\n${ip}\n${agent}`);
  const payload = [fingerprint, String(epoch), String(nowSeconds), request.method, url.pathname].join("\n");
  headers.set("x-nexa-v6-solver-fingerprint", fingerprint);
  headers.set("x-nexa-v6-edge-epoch", String(epoch));
  headers.set("x-nexa-v6-edge-timestamp", String(nowSeconds));
  headers.set("x-nexa-v6-edge-signature", await hmacHex(secret, payload));
}

async function attachTrustedAppAccessIdentity(
  headers,
  request,
  env,
  nowSeconds = Math.floor(Date.now() / 1000),
  options = {},
) {
  for (const name of APP_ACCESS_HEADERS) headers.delete(name);
  const email = await trustedAccessEmail(request, env, options, nowSeconds);
  const secret = String(env.NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET ?? "");
  if (!email || secret.length < 32) return;
  const pathname = new URL(request.url).pathname;
  const timestamp = String(nowSeconds);
  const payload = ["app-access", timestamp, request.method, pathname, email].join("\n");
  headers.set("x-nexa-app-access-email", email);
  headers.set("x-nexa-app-access-timestamp", timestamp);
  headers.set("x-nexa-app-access-signature", await hmacHex(secret, payload));
}

function originUrl(env, requestUrl) {
  const configured = new URL(String(env.NEXA_ORIGIN_URL ?? ""));
  if (configured.protocol !== "https:" || configured.username || configured.password
      || configured.search || configured.hash) {
    throw new Error("NEXA_ORIGIN_URL_INVALID");
  }
  const incoming = new URL(requestUrl);
  if (configured.hostname === incoming.hostname) throw new Error("NEXA_ORIGIN_URL_LOOP");
  configured.pathname = incoming.pathname;
  configured.search = incoming.search;
  configured.hash = "";
  return configured;
}

async function proxyOriginRequest(request, env, options = {}) {
  const solverCors = options.solverCors === true;
  if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET
      || !env.NEXA_ORIGIN_URL) {
    return json(503, { ok: false, error: "edge_origin_configuration_missing" }, { solverCors });
  }

  let upstreamUrl;
  try {
    upstreamUrl = originUrl(env, request.url);
  } catch {
    return json(503, { ok: false, error: "edge_origin_configuration_invalid" }, { solverCors });
  }

  const incoming = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("cf-access-jwt-assertion");
  headers.delete("cf-connecting-ip");
  headers.delete("x-forwarded-for");
  headers.delete("true-client-ip");
  for (const name of EDGE_HEADERS) headers.delete(name);
  headers.set("CF-Access-Client-Id", String(env.CF_ACCESS_CLIENT_ID));
  headers.set("CF-Access-Client-Secret", String(env.CF_ACCESS_CLIENT_SECRET));
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  if (options.solverIdentity === true) {
    await attachTrustedEdgeIdentity(headers, request, env, options.nowSeconds);
  }
  if (options.appAccessIdentity === true) {
    await attachTrustedAppAccessIdentity(headers, request, env, options.nowSeconds, options);
  } else {
    for (const name of APP_ACCESS_HEADERS) headers.delete(name);
  }

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const requestBody = ["GET", "HEAD", "OPTIONS"].includes(request.method)
      ? undefined
      : request.body;
    const upstream = await fetchImpl(new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: requestBody,
      ...(requestBody ? { duplex: "half" } : {}),
      redirect: "manual",
    }));
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("set-cookie");
    responseHeaders.delete("www-authenticate");
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.set("referrer-policy", "no-referrer");
    if (solverCors) withSolverCors(responseHeaders);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return json(502, { ok: false, error: "origin_unavailable" }, { solverCors });
  }
}

async function serveApplication(request, env) {
  if (!env.ASSETS?.fetch) {
    return json(503, { ok: false, error: "application_assets_not_configured" });
  }
  const response = await env.ASSETS.fetch(request);
  const pathname = new URL(request.url).pathname;
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";

  if (pathname === "/sw.js") {
    headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");
    headers.set("service-worker-allowed", "/");
  } else if (
    contentType.includes("text/html")
    || pathname === "/manifest.webmanifest"
    || pathname === "/apple-touch-icon.png"
    || /^\/icon-(?:192|512)(?:-maskable)?\.png$/.test(pathname)
  ) {
    headers.set("cache-control", "no-cache, must-revalidate");
  } else if (pathname.startsWith("/assets/")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(request, env, options = {}) {
  const incoming = new URL(request.url);
  const host = incoming.hostname.toLowerCase();

  if (host === APP_HOST) {
    if (incoming.pathname.startsWith("/api/")) {
      if (!incoming.pathname.startsWith("/api/v6/")) {
        return json(404, { ok: false, error: "api_route_not_found" });
      }
      return proxyOriginRequest(request, env, {
        ...options,
        solverCors: false,
        solverIdentity: false,
        appAccessIdentity: true,
      });
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return json(405, { ok: false, error: "method_not_allowed" });
    }
    return serveApplication(request, env);
  }

  if (host !== SOLVER_HOST) {
    return json(404, { ok: false, error: "edge_host_not_found" });
  }

  const staticDiscovery = edgeStaticDiscoveryResponse(request, incoming.pathname);
  if (staticDiscovery) return staticDiscovery;
  const stableDiscovery = edgeStableDiscoveryResponse(request, incoming.pathname);
  if (stableDiscovery) return stableDiscovery;

  if (request.method === "OPTIONS" && isPublicRoute(request.method, incoming.pathname)) {
    return new Response(null, { status: 204, headers: withSolverCors() });
  }
  if (!isPublicRoute(request.method, incoming.pathname)) {
    return json(404, { ok: false, error: "public_solver_route_not_found" }, { solverCors: true });
  }
  const response = await proxyOriginRequest(request, env, {
    ...options,
    solverCors: true,
    solverIdentity: true,
  });
  return request.method === "GET"
    ? decorateOriginDiscoveryResponse(response, incoming.pathname)
    : response;
}

export {
  APP_HOST,
  APP_ACCESS_HEADERS,
  EDGE_STATIC_DISCOVERY_PATHS,
  EDGE_STABLE_DISCOVERY,
  LLMS_TEXT,
  ORIGIN_STABLE_DISCOVERY_PATHS,
  ROBOTS_TEXT,
  ROOT_HTML,
  SOLVER_HOST,
  SITEMAP_XML,
  SOLVER_INDEXNOW_KEY,
  SOLVER_INDEXNOW_KEY_FILE,
  SOLVER_ROOT_DESCRIPTION,
  SOLVER_ROOT_TITLE,
  attachTrustedAppAccessIdentity,
  attachTrustedEdgeIdentity,
  decorateOriginDiscoveryResponse,
  edgeStaticDiscoveryResponse,
  edgeStableDiscoveryResponse,
  handleRequest,
  hmacHex,
  isEdgeStaticDiscoveryRoute,
  isPublicRoute,
  originUrl,
  verifiedAccessEmailFromAssertion,
  withSolverCors,
};

export default {
  fetch(request, env, executionContext) {
    return handleRequest(request, env, { executionContext });
  },
};
