import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_ENDPOINTS, PUBLIC_PATHS } from "../src/public-endpoints.mjs";
import { handleRequest } from "../src/worker.mjs";

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

test("Worker proxies only the public route allowlist with public CORS", async () => {
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
  assert.equal(upstream.length, 8);
  assert.equal(new URL(upstream[0].url).pathname, PUBLIC_PATHS.manifest);

  for (const path of ["/", "/api/unsupported/solver-feed", "/api/v6/not-allowed", "/manifest.json"]) {
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
