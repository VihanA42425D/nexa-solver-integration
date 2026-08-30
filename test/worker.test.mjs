import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_ENDPOINTS, PUBLIC_PATHS } from "../src/public-endpoints.mjs";
import {
  EDGE_STABLE_DISCOVERY,
  LLMS_TEXT,
  ROBOTS_TEXT,
  ROOT_HTML,
  SITEMAP_XML,
  SOLVER_INDEXNOW_KEY,
  SOLVER_INDEXNOW_KEY_FILE,
  SOLVER_ROOT_DESCRIPTION,
  SOLVER_ROOT_TITLE,
  handleRequest,
  recordEdgeDiscoveryTelemetry,
} from "../src/worker.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const secretBinding = ["CF_ACCESS_CLIENT", "SECRET"].join("_");

function enabledEnv(extra = {}) {
  return {
    NEXA_ORIGIN_URL: "https://origin.invalid",
    CF_ACCESS_CLIENT_ID: "fixture-access-id",
    [secretBinding]: "fixture-access-credential",
    NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET: "fixture-hmac-secret-that-is-at-least-32-bytes",
    ...extra,
  };
}

test("static discovery is the final active signed Feed surface", async () => {
  const generated = await readJson("../public/.well-known/nexa-solver.json");
  assert.equal(generated.deploymentVersion, 6);
  assert.equal(generated.deploymentStatus, "ACTIVE");
  assert.equal(generated.activationRequired, false);
  assert.equal(generated.feedSigner, "0xCbeC1dDeEA1f4317ce6eF6F33Ad46d1fFD81c163");
  assert.deepEqual(generated.solverProfile.executionScopes, ["INTRA_CHAIN", "CROSS_CHAIN"]);
  assert.equal(generated.executionModel, "EXACTLY_ONE_BOT_SOURCE_TX_PLUS_ONE_NEXA_DESTINATION_TX");
  assert.deepEqual(generated.endpoints, PUBLIC_ENDPOINTS);
});

test("Worker serves stable documents at the Edge and proxies only the dynamic allowlist", async () => {
  const upstream = [];
  const fetchImpl = async (request) => {
    upstream.push(request);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": "forbidden=1" },
    });
  };
  for (const url of [
    PUBLIC_ENDPOINTS.manifest,
    PUBLIC_ENDPOINTS.onchainDiscovery,
    PUBLIC_ENDPOINTS.openapi,
    PUBLIC_ENDPOINTS.standards,
    PUBLIC_ENDPOINTS.solverDiscovery,
    PUBLIC_ENDPOINTS.solverFeed,
    PUBLIC_ENDPOINTS.routeDetailTemplate.replace("{routeId}", "0x" + "11".repeat(32)),
    PUBLIC_ENDPOINTS.permitStatusTemplate.replace("{fillId}", "0x" + "22".repeat(32)),
  ]) {
    const response = await handleRequest(new Request(url), enabledEnv(), { fetchImpl });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(upstream.length, 3);
  assert.equal(new URL(upstream[0].url).pathname, PUBLIC_PATHS.solverFeed);

  for (const path of ["/api/unsupported/solver-feed", "/api/v6/not-allowed", "/manifest.json"]) {
    const response = await handleRequest(
      new Request(new URL(path, "https://solver.vsnexa.com")),
      enabledEnv(),
      { fetchImpl: async () => assert.fail("arbitrary path reached origin") },
    );
    assert.equal(response.status, 404);
  }
});

test("Worker proxies Permit bodies and attaches trusted Edge identity", async () => {
  let upstreamRequest;
  const body = JSON.stringify({ quoteId: "0x" + "11".repeat(32) });
  const response = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.executionPermits, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.7",
        "User-Agent": "solver-fixture",
      },
      body,
    }),
    enabledEnv(),
    {
      fetchImpl: async (request) => {
        upstreamRequest = request;
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "content-type": "application/json", "set-cookie": "forbidden=1" },
        });
      },
    },
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(await upstreamRequest.text(), body);
  assert.equal(upstreamRequest.headers.get("CF-Access-Client-Id"), "fixture-access-id");
  assert.equal(upstreamRequest.headers.get("CF-Access-Client-Secret"), "fixture-access-credential");
  assert.match(upstreamRequest.headers.get("X-Nexa-V6-Solver-Fingerprint"), /^[0-9a-f]{64}$/);
  assert.match(upstreamRequest.headers.get("X-Nexa-V6-Edge-Signature"), /^[0-9a-f]{64}$/);
  assert.equal(upstreamRequest.headers.has("CF-Connecting-IP"), false);
});

test("Worker isolates invalid origins and does not forge identity without HMAC", async () => {
  const invalid = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeed),
    enabledEnv({ NEXA_ORIGIN_URL: "https://solver.vsnexa.com" }),
  );
  assert.equal(invalid.status, 503);

  let upstreamRequest;
  const response = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeed),
    enabledEnv({ NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET: "" }),
    { fetchImpl: async (request) => {
      upstreamRequest = request;
      return new Response("{}", { status: 200 });
    } },
  );
  assert.equal(response.status, 200);
  assert.equal(upstreamRequest.headers.has("X-Nexa-V6-Solver-Fingerprint"), false);
  assert.equal(upstreamRequest.headers.has("X-Nexa-V6-Edge-Signature"), false);
});

test("event proxy preserves SSE streaming semantics", async () => {
  const encoder = new TextEncoder();
  let streamController;
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
    },
  });
  let upstreamRequest;
  const response = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeedEvents + "?cursor=7"),
    enabledEnv(),
    { fetchImpl: async (request) => {
      upstreamRequest = request;
      return new Response(stream, {
        status: 200,
        headers: { "cache-control": "no-cache", "content-type": "text/event-stream" },
      });
    } },
  );
  assert.equal(upstreamRequest.url, "https://origin.invalid" + PUBLIC_PATHS.solverFeedEvents + "?cursor=7");
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), "event: ready\ndata: {}\n\n");
  streamController.close();
  await reader.cancel();
});

test("Worker serves canonical crawler documents and IndexNow ownership at the Edge", async () => {
  const solverManifest = await readJson("../public/.well-known/nexa-solver.json");
  const onchainDiscovery = await readJson("../public/.well-known/nexa-onchain-discovery.json");
  const standardsManifest = await readJson("../public/.well-known/nexa-standards.json");
  const openApiDocument = await readJson("../openapi/openapi.json");
  let originCalls = 0;
  let bindingReads = 0;
  const env = new Proxy({}, {
    get() {
      bindingReads += 1;
      throw new Error("static crawler discovery must not read bindings");
    },
  });
  const expected = new Map([
    ["/", ["text/html; charset=utf-8", ROOT_HTML]],
    ["/robots.txt", ["text/plain; charset=utf-8", ROBOTS_TEXT, "noindex, follow"]],
    ["/sitemap.xml", ["application/xml; charset=utf-8", SITEMAP_XML, "noindex, follow"]],
    ["/llms.txt", ["text/plain; charset=utf-8", LLMS_TEXT, "noindex, follow"]],
    ["/.well-known/nexa-solver.json", ["application/json; charset=utf-8", JSON.stringify(solverManifest)]],
    ["/.well-known/nexa-onchain-discovery.json", ["application/json; charset=utf-8", JSON.stringify(onchainDiscovery)]],
    ["/.well-known/nexa-standards.json", ["application/json; charset=utf-8", JSON.stringify(standardsManifest)]],
    ["/openapi.json", ["application/json; charset=utf-8", JSON.stringify(openApiDocument)]],
    ["/api/v6/solver-discovery", ["application/json; charset=utf-8", JSON.stringify(solverManifest)]],
    [`/${SOLVER_INDEXNOW_KEY_FILE}`, ["text/plain; charset=utf-8", SOLVER_INDEXNOW_KEY, "noindex, nofollow"]],
  ]);

  for (const [pathname, [contentType, body, robotsTag = "index, follow"]] of expected) {
    const response = await handleRequest(
      new Request(`https://solver.vsnexa.com${pathname}`),
      env,
      { fetchImpl: async () => { originCalls += 1; throw new Error("unexpected origin call"); } },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), contentType);
    assert.equal(response.headers.get("x-robots-tag"), robotsTag);
    if (robotsTag === "index, follow") {
      assert.match(response.headers.get("link"), /rel="service-desc"/);
      if (pathname !== "/") {
        assert.match(
          response.headers.get("link"),
          new RegExp(`<https://solver\\.vsnexa\\.com${pathname.replaceAll(".", "\\.")}>; rel="canonical"`),
        );
      }
    } else {
      assert.equal(response.headers.get("link"), null);
    }
    assert.equal(await response.text(), body);

    const head = await handleRequest(
      new Request(`https://solver.vsnexa.com${pathname}`, { method: "HEAD" }),
      env,
      { fetchImpl: async () => { originCalls += 1; throw new Error("unexpected origin call"); } },
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }

  assert.equal(ROBOTS_TEXT, "User-agent: *\nAllow: /\nSitemap: https://solver.vsnexa.com/sitemap.xml\n");
  assert.deepEqual(
    [...SITEMAP_XML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
    [
      "https://solver.vsnexa.com/",
      "https://solver.vsnexa.com/.well-known/nexa-solver.json",
      "https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json",
      "https://solver.vsnexa.com/.well-known/nexa-standards.json",
      "https://solver.vsnexa.com/openapi.json",
      "https://solver.vsnexa.com/api/v6/solver-discovery",
    ],
  );
  assert.strictEqual(
    EDGE_STABLE_DISCOVERY["/.well-known/nexa-solver.json"].body,
    EDGE_STABLE_DISCOVERY["/api/v6/solver-discovery"].body,
  );
  assert(Object.isFrozen(EDGE_STABLE_DISCOVERY));
  assert.match(ROOT_HTML, /rel="canonical" href="https:\/\/solver\.vsnexa\.com\/"/);
  assert.match(ROOT_HTML, new RegExp(`<title>${SOLVER_ROOT_TITLE}</title>`));
  assert.match(ROOT_HTML, new RegExp(`<meta name="description" content="${SOLVER_ROOT_DESCRIPTION}"`));
  assert(SOLVER_ROOT_TITLE.length >= 20 && SOLVER_ROOT_TITLE.length <= 60);
  assert(SOLVER_ROOT_DESCRIPTION.length >= 90 && SOLVER_ROOT_DESCRIPTION.length <= 155);
  assert.equal((ROOT_HTML.match(/<h1[ >]/g) ?? []).length, 1);
  assert(Buffer.byteLength(ROOT_HTML) <= 8 * 1024);
  const rootWords = ROOT_HTML
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  assert(rootWords >= 90 && rootWords <= 250);
  const rootStructuredData = JSON.parse(
    ROOT_HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(rootStructuredData["@type"], "WebAPI");
  assert.equal(rootStructuredData.name, SOLVER_ROOT_TITLE);
  assert.equal(rootStructuredData.description, SOLVER_ROOT_DESCRIPTION);
  assert.equal(rootStructuredData.documentation, "https://docs.vsnexa.com/api/");
  assert.match(LLMS_TEXT, /Graph and Substreams are non-authoritative indexes/);
  assert.equal(originCalls, 0);
  assert.equal(bindingReads, 0);
});

test("static discovery emits correlatable Edge diagnostics without DB, RPC, HTTP, or raw IP", async () => {
  const entries = [];
  const env = enabledEnv();
  const request = new Request(PUBLIC_ENDPOINTS.openapi, {
    headers: {
      "cf-connecting-ip": "203.0.113.19",
      "user-agent": "ExampleCrawler/1.0",
      accept: "application/json",
    },
  });
  assert.equal(await recordEdgeDiscoveryTelemetry(request, env, {
    nowSeconds: 2_000_000_000,
    logger: { info(label, value) { entries.push({ label, value }); } },
  }), true);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].label, "nexa_v6_edge_discovery");
  const entry = JSON.parse(entries[0].value);
  assert.equal(entry.eventType, "OPENAPI_READ");
  assert.equal(entry.trafficClass, "PUBLIC_AUTOMATION");
  assert.equal(entry.automationEvidence.pattern, "crawler-token");
  assert.match(entry.solverFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(entry, "ip"), false);
  assert.equal(entries[0].value.includes("203.0.113.19"), false);

  let forwardedFingerprint;
  const longAgent = `solver-client/${"a".repeat(300)}`;
  await handleRequest(new Request("https://solver.vsnexa.com/api/v6/solver-feed", {
    headers: {
      "cf-connecting-ip": "203.0.113.19",
      "user-agent": longAgent,
    },
  }), env, {
    nowSeconds: 2_000_000_000,
    fetchImpl: async (upstream) => {
      forwardedFingerprint = upstream.headers.get("x-nexa-v6-solver-fingerprint");
      return new Response("{}", { headers: { "content-type": "application/json" } });
    },
  });
  const longAgentEntry = [];
  await recordEdgeDiscoveryTelemetry(new Request(PUBLIC_ENDPOINTS.openapi, {
    headers: {
      "cf-connecting-ip": "203.0.113.19",
      "user-agent": longAgent,
    },
  }), env, {
    nowSeconds: 2_000_000_000,
    logger: { info(_label, value) { longAgentEntry.push(JSON.parse(value)); } },
  });
  assert.equal(longAgentEntry[0].solverFingerprint, forwardedFingerprint);

  const internalEntry = [];
  await recordEdgeDiscoveryTelemetry(new Request(PUBLIC_ENDPOINTS.openapi), env, {
    nowSeconds: 2_000_000_000,
    logger: { info(_label, value) { internalEntry.push(JSON.parse(value)); } },
  });
  assert.equal(internalEntry[0].trafficClass, "UNATTRIBUTED_DIRECT");
});

test("Worker adds crawler headers and CDN cache policy to stable discovery only", async () => {
  const fetchImpl = async () => new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  for (const url of [
    PUBLIC_ENDPOINTS.manifest,
    PUBLIC_ENDPOINTS.onchainDiscovery,
    PUBLIC_ENDPOINTS.standards,
    PUBLIC_ENDPOINTS.openapi,
    PUBLIC_ENDPOINTS.solverDiscovery,
  ]) {
    const response = await handleRequest(new Request(url), enabledEnv(), { fetchImpl });
    assert.equal(response.headers.get("x-robots-tag"), "index, follow");
    assert.match(response.headers.get("link"), /nexa-solver\.json/);
    assert.match(response.headers.get("cloudflare-cdn-cache-control"), /public, max-age=/);
  }

  for (const url of [
    PUBLIC_ENDPOINTS.solverFeed,
    PUBLIC_ENDPOINTS.solverFeedEvents,
    PUBLIC_ENDPOINTS.routeDetailTemplate.replace("{routeId}", "0x" + "11".repeat(32)),
    PUBLIC_ENDPOINTS.permitStatusTemplate.replace("{fillId}", "0x" + "22".repeat(32)),
  ]) {
    const response = await handleRequest(new Request(url), enabledEnv(), { fetchImpl });
    assert.equal(response.headers.get("x-robots-tag"), null);
    assert.equal(response.headers.get("link"), null);
    assert.equal(response.headers.get("cloudflare-cdn-cache-control"), null);
  }

  const post = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.executionPermits, { method: "POST", body: "{}" }),
    enabledEnv(),
    { fetchImpl },
  );
  assert.equal(post.headers.get("x-robots-tag"), null);
  assert.equal(post.headers.get("link"), null);
});

test("verification Worker owns only exact static solver discovery routes", async () => {
  const config = await readJson("../wrangler.jsonc");
  const patterns = config.routes.map((route) => route.pattern);
  assert.deepEqual(patterns, [
    "solver.vsnexa.com/",
    "solver.vsnexa.com/robots.txt",
    "solver.vsnexa.com/sitemap.xml",
    "solver.vsnexa.com/llms.txt",
    `solver.vsnexa.com/${SOLVER_INDEXNOW_KEY_FILE}`,
    "solver.vsnexa.com/.well-known/nexa-solver.json",
    "solver.vsnexa.com/.well-known/nexa-onchain-discovery.json",
    "solver.vsnexa.com/.well-known/nexa-standards.json",
    "solver.vsnexa.com/openapi.json",
    "solver.vsnexa.com/api/v6/solver-discovery",
  ]);
  assert(patterns.every((pattern) => !pattern.includes("*")));
  assert(patterns.every((pattern) => !pattern.includes("/api/v6/solver-feed")));
  assert(patterns.every((pattern) => !pattern.includes("/api/v6/execution-permits")));
});
