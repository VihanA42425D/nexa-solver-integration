import {
  PUBLIC_PATHS,
  allowedMethodsForPath,
  isDynamicApiPath,
} from "./public-endpoints.mjs";

const encoder = new TextEncoder();

const jsonError = (status, error) => new Response(
  JSON.stringify({ error }),
  {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  },
);

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const readOriginBindings = (env) => {
  const originUrl = env?.SOLVER_ORIGIN_URL;
  if (!originUrl) return { error: "SOLVER_ORIGIN_NOT_CONFIGURED" };
  const accessId = env?.CF_ACCESS_CLIENT_ID;
  const accessCredential = env?.CF_ACCESS_CLIENT_SECRET;
  if (!accessId || !accessCredential) return { error: "SOLVER_ORIGIN_AUTH_NOT_CONFIGURED" };
  const telemetrySecret = String(env?.NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET ?? "");
  if (telemetrySecret.length < 32) return { error: "SOLVER_EDGE_TELEMETRY_AUTH_NOT_CONFIGURED" };
  try {
    const origin = new URL(originUrl);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
      return { error: "SOLVER_ORIGIN_INVALID" };
    }
    return { origin, accessId, accessCredential, telemetrySecret };
  } catch {
    return { error: "SOLVER_ORIGIN_INVALID" };
  }
};

async function trustedTelemetryHeaders(request, secret, pathname) {
  const now = Math.floor(Date.now() / 1000);
  const epoch = Math.floor(now / 86_400);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const userAgent = request.headers.get("User-Agent") ?? "unknown";
  const fingerprint = await hmacHex(secret, `solver\n${epoch}\n${ip}\n${userAgent}`);
  const signature = await hmacHex(
    secret,
    `${fingerprint}\n${epoch}\n${now}\n${request.method.toUpperCase()}\n${pathname}`,
  );
  return { fingerprint, epoch, now, signature };
}

const proxySolverRequest = async (request, env, fetcher) => {
  const bindings = readOriginBindings(env);
  if (bindings.error) return jsonError(503, bindings.error);
  const incoming = new URL(request.url);
  if (bindings.origin.hostname === incoming.hostname) return jsonError(503, "SOLVER_ORIGIN_INVALID");
  const target = new URL(bindings.origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const edge = await trustedTelemetryHeaders(request, bindings.telemetrySecret, incoming.pathname);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("CF-Connecting-IP");
  headers.delete("X-Forwarded-For");
  headers.delete("True-Client-IP");
  headers.delete("X-Nexa-V6-Solver-Fingerprint");
  headers.delete("X-Nexa-V6-Edge-Epoch");
  headers.delete("X-Nexa-V6-Edge-Timestamp");
  headers.delete("X-Nexa-V6-Edge-Signature");
  headers.set("CF-Access-Client-Id", bindings.accessId);
  headers.set("CF-Access-Client-Secret", bindings.accessCredential);
  headers.set("X-Nexa-V6-Solver-Fingerprint", edge.fingerprint);
  headers.set("X-Nexa-V6-Edge-Epoch", String(edge.epoch));
  headers.set("X-Nexa-V6-Edge-Timestamp", String(edge.now));
  headers.set("X-Nexa-V6-Edge-Signature", edge.signature);

  const body = ["GET", "HEAD", "OPTIONS"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  try {
    const upstream = await fetcher(new Request(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    }));
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("set-cookie");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonError(502, "SOLVER_ORIGIN_UNAVAILABLE");
  }
};

export const handleRequest = async (request, env, fetcher = fetch) => {
  const { pathname } = new URL(request.url);
  const isManifest = pathname === PUBLIC_PATHS.manifest;
  const isDynamic = isDynamicApiPath(pathname);
  if (!isManifest && !isDynamic) return jsonError(404, "NOT_FOUND");
  if (!allowedMethodsForPath(pathname).has(request.method)) return jsonError(405, "METHOD_NOT_ALLOWED");
  if (isManifest) {
    if (!env?.ASSETS?.fetch) return jsonError(503, "STATIC_ASSETS_NOT_CONFIGURED");
    return env.ASSETS.fetch(request);
  }
  return proxySolverRequest(request, env, fetcher);
};

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
