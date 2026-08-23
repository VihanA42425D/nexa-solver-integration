const SOLVER_HOST = "solver.vsnexa.com";
const APP_HOST = "vsnexa.com";

const PUBLIC_ROUTES = Object.freeze([
  Object.freeze({ method: "GET", pattern: /^\/\.well-known\/nexa-solver\.json$/ }),
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

  if (request.method === "OPTIONS" && isPublicRoute(request.method, incoming.pathname)) {
    return new Response(null, { status: 204, headers: withSolverCors() });
  }
  if (!isPublicRoute(request.method, incoming.pathname)) {
    return json(404, { ok: false, error: "public_solver_route_not_found" }, { solverCors: true });
  }
  return proxyOriginRequest(request, env, {
    ...options,
    solverCors: true,
    solverIdentity: true,
  });
}

export {
  APP_HOST,
  APP_ACCESS_HEADERS,
  SOLVER_HOST,
  attachTrustedAppAccessIdentity,
  attachTrustedEdgeIdentity,
  handleRequest,
  hmacHex,
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
