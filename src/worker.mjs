import { DYNAMIC_API_PATHS, PUBLIC_PATHS } from "./public-endpoints.mjs";

const dynamicApiPaths = new Set(DYNAMIC_API_PATHS);
const allowedMethods = new Set(["GET", "HEAD"]);

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

const readOriginBindings = (env) => {
  const originUrl = env?.SOLVER_ORIGIN_URL;
  if (!originUrl) return { error: "SOLVER_ORIGIN_NOT_CONFIGURED" };

  const accessId = env?.CF_ACCESS_CLIENT_ID;
  const accessCredential = env?.CF_ACCESS_CLIENT_SECRET;
  if (!accessId || !accessCredential) {
    return { error: "SOLVER_ORIGIN_AUTH_NOT_CONFIGURED" };
  }

  try {
    const origin = new URL(originUrl);
    if (origin.protocol !== "https:" || origin.username || origin.password
      || origin.search || origin.hash) {
      return { error: "SOLVER_ORIGIN_INVALID" };
    }
    return { origin, accessId, accessCredential };
  } catch {
    return { error: "SOLVER_ORIGIN_INVALID" };
  }
};

const proxySolverRequest = async (request, env, fetcher) => {
  const bindings = readOriginBindings(env);
  if (bindings.error) return jsonError(503, bindings.error);

  const incoming = new URL(request.url);
  if (bindings.origin.hostname === incoming.hostname) {
    return jsonError(503, "SOLVER_ORIGIN_INVALID");
  }

  const target = new URL(bindings.origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("CF-Access-Client-Id", bindings.accessId);
  headers.set("CF-Access-Client-Secret", bindings.accessCredential);

  try {
    const upstream = await fetcher(new Request(target, {
      method: request.method,
      headers,
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
  const isDynamicApi = dynamicApiPaths.has(pathname);

  if (!isManifest && !isDynamicApi) return jsonError(404, "NOT_FOUND");
  if (!allowedMethods.has(request.method)) return jsonError(405, "METHOD_NOT_ALLOWED");

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
