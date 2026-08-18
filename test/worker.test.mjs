import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_ENDPOINTS, PUBLIC_PATHS } from "../src/public-endpoints.mjs";
import { handleRequest } from "../src/worker.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const secretBinding = ["CF_ACCESS_CLIENT", "SECRET"].join("_");

function enabledEnv(extra = {}) {
  return {
    SOLVER_ORIGIN_URL: "https://origin.invalid",
    CF_ACCESS_CLIENT_ID: "fixture-access-id",
    [secretBinding]: "fixture-access-credential",
    NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET: "fixture-hmac-secret-that-is-at-least-32-bytes",
    ...extra,
  };
}

test("static solver manifest is generated from V6 public inputs", async () => {
  const generated = await readJson("../public/.well-known/nexa-solver.json");
  assert.equal(generated.deploymentVersion, 6);
  assert.equal(generated.deploymentStatus, "DEPLOYED_AWAITING_CUTOVER");
  assert.equal(generated.activationRequired, true);
  assert.deepEqual(generated.solverProfile.executionScopes, ["INTRA_CHAIN", "CROSS_CHAIN"]);
  assert.equal(generated.solverProfile.variableSizeExecution, true);
  assert.equal(generated.solverProfile.machineVerifiableState, true);
  assert.equal(generated.solverProfile.periodicOnchainPublicationRequired, false);
  assert.equal(Object.hasOwn(generated, "executionModel"), false);
  assert.deepEqual(generated.endpoints, PUBLIC_ENDPOINTS);
});

test("Worker exposes only the allowlisted V6 surface", async () => {
  let assetRequests = 0;
  const env = {
    ASSETS: {
      async fetch() {
        assetRequests += 1;
        return new Response("{}", { status: 200 });
      },
    },
  };
  const manifestResponse = await handleRequest(new Request(PUBLIC_ENDPOINTS.manifest), env);
  assert.equal(manifestResponse.status, 200);
  assert.equal(assetRequests, 1);

  for (const url of [
    PUBLIC_ENDPOINTS.solverDiscovery,
    PUBLIC_ENDPOINTS.solverFeed,
    PUBLIC_ENDPOINTS.routeDetailTemplate.replace("{routeId}", "0x" + "11".repeat(32)),
    PUBLIC_ENDPOINTS.permitStatusTemplate.replace("{fillId}", "0x" + "22".repeat(32)),
  ]) {
    const response = await handleRequest(new Request(url), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "SOLVER_ORIGIN_NOT_CONFIGURED" });
  }

  for (const path of ["/", "/api/v5/solver-feed", "/api/v6/not-allowed", "/manifest.json"]) {
    const response = await handleRequest(
      new Request(new URL(path, "https://solver.vsnexa.com")),
      enabledEnv(),
      async () => assert.fail("arbitrary path reached origin"),
    );
    assert.equal(response.status, 404);
  }
});

test("Worker proxies POST Permit bodies and attaches trusted Edge telemetry headers", async () => {
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
    async (request) => {
      upstreamRequest = request;
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json", "set-cookie": "forbidden=1" },
      });
    },
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(upstreamRequest.method, "POST");
  assert.equal(await upstreamRequest.text(), body);
  assert.equal(upstreamRequest.headers.get("CF-Access-Client-Id"), "fixture-access-id");
  assert.equal(upstreamRequest.headers.get("CF-Access-Client-Secret"), "fixture-access-credential");
  assert.match(upstreamRequest.headers.get("X-Nexa-V6-Solver-Fingerprint"), /^[0-9a-f]{64}$/);
  assert.match(upstreamRequest.headers.get("X-Nexa-V6-Edge-Signature"), /^[0-9a-f]{64}$/);
  assert.equal(upstreamRequest.headers.has("CF-Connecting-IP"), false);
});

test("Worker rejects wrong methods and missing telemetry secret", async () => {
  const wrong = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeed, { method: "POST" }),
    enabledEnv(),
  );
  assert.equal(wrong.status, 405);

  const missingSecret = enabledEnv({ NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET: "" });
  const response = await handleRequest(new Request(PUBLIC_ENDPOINTS.solverFeed), missingSecret);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "SOLVER_EDGE_TELEMETRY_AUTH_NOT_CONFIGURED" });
});

test("enabled event proxy preserves SSE streaming semantics", async () => {
  const encoder = new TextEncoder();
  let streamController;
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
    },
  });
  const upstream = new Response(stream, {
    status: 200,
    headers: { "cache-control": "no-cache", "content-type": "text/event-stream" },
  });
  let upstreamRequest;
  const response = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeedEvents + "?cursor=7"),
    enabledEnv(),
    async (request) => {
      upstreamRequest = request;
      return upstream;
    },
  );
  assert.equal(upstreamRequest.url, "https://origin.invalid" + PUBLIC_PATHS.solverFeedEvents + "?cursor=7");
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), "event: ready\ndata: {}\n\n");
  streamController.close();
  await reader.cancel();
});
