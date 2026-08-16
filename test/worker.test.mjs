import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DYNAMIC_API_PATHS,
  PUBLIC_ENDPOINTS,
  PUBLIC_PATHS,
} from "../src/public-endpoints.mjs";
import { handleRequest } from "../src/worker.mjs";

const readJson = async (path) => JSON.parse(await readFile(
  new URL(path, import.meta.url),
  "utf8",
));

test("only the five intended public paths are declared", () => {
  assert.deepEqual(Object.values(PUBLIC_ENDPOINTS), [
    "https://solver.vsnexa.com/.well-known/nexa-solver.json",
    "https://solver.vsnexa.com/api/v5/solver-discovery",
    "https://solver.vsnexa.com/api/v5/solver-feed",
    "https://solver.vsnexa.com/api/v5/solver-feed/events",
    "https://solver.vsnexa.com/api/v5/solver-feed/status",
  ]);
  assert.deepEqual(DYNAMIC_API_PATHS, Object.values(PUBLIC_PATHS).slice(1));
});

test("static solver manifest is generated from the verified public inputs", async () => {
  const [generated, manifest, addresses, standards] = await Promise.all([
    readJson("../public/.well-known/nexa-solver.json"),
    readJson("../manifest.json"),
    readJson("../addresses/mainnet.json"),
    readJson("../standards/standard-ids.json"),
  ]);
  assert.deepEqual(generated.manifest, manifest);
  assert.deepEqual(generated.addresses, addresses);
  assert.deepEqual(generated.standards, standards);
  assert.deepEqual(generated.endpoints, PUBLIC_ENDPOINTS);
});

test("Worker exposes only the manifest and four fail-closed API paths", async () => {
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

  for (const path of DYNAMIC_API_PATHS) {
    const response = await handleRequest(
      new Request(new URL(path, "https://solver.vsnexa.com")),
      env,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "SOLVER_ORIGIN_NOT_CONFIGURED" });
  }

  const serviceSecretBinding = ["CF_ACCESS_CLIENT", "SECRET"].join("_");
  const proxyEnabledEnv = {
    ...env,
    SOLVER_ORIGIN_URL: new URL("https://origin.invalid").href,
    CF_ACCESS_CLIENT_ID: "fixture-access-id",
    [serviceSecretBinding]: "fixture-access-credential",
  };
  for (const path of [
    "/",
    "/manifest.json",
    "/addresses/mainnet.json",
    "/api",
    "/api/v5",
    "/api/v5/solver-feed/extra",
    "/api/v5/not-allowed",
  ]) {
    const response = await handleRequest(
      new Request(new URL(path, "https://solver.vsnexa.com")),
      proxyEnabledEnv,
      async () => assert.fail("arbitrary path reached the origin proxy"),
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "NOT_FOUND" });
  }
  assert.equal(assetRequests, 1);
});

test("Worker does not hardcode an origin or Wrangler variable", async () => {
  const [workerSource, wrangler] = await Promise.all([
    readFile(new URL("../src/worker.mjs", import.meta.url), "utf8"),
    readJson("../wrangler.jsonc"),
  ]);
  assert.doesNotMatch(workerSource, /https?:\/\//i);
  assert.equal(Object.hasOwn(wrangler, "vars"), false);
  assert.equal(JSON.stringify(wrangler).includes("SOLVER_ORIGIN"), false);
  assert.equal(wrangler.assets.run_worker_first, true);
});

test("enabled event proxy preserves SSE streaming semantics", async () => {
  const serviceSecretBinding = ["CF_ACCESS_CLIENT", "SECRET"].join("_");
  const testOrigin = new URL("https://origin.invalid");
  const env = {
    SOLVER_ORIGIN_URL: testOrigin.href,
    CF_ACCESS_CLIENT_ID: "fixture-access-id",
    [serviceSecretBinding]: "fixture-access-credential",
  };
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
    headers: {
      "cache-control": "no-cache",
      "content-type": "text/event-stream",
      "set-cookie": "CF_Authorization=fixture",
    },
  });
  let upstreamRequest;
  const response = await handleRequest(
    new Request(PUBLIC_ENDPOINTS.solverFeedEvents + "?cursor=7"),
    env,
    async (request) => {
      upstreamRequest = request;
      return upstream;
    },
  );

  assert.equal(
    upstreamRequest.url,
    testOrigin.origin + PUBLIC_PATHS.solverFeedEvents + "?cursor=7",
  );
  assert.equal(upstreamRequest.headers.get("CF-Access-Client-Id"), "fixture-access-id");
  assert.equal(
    upstreamRequest.headers.get("CF-Access-Client-Secret"),
    "fixture-access-credential",
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(response.headers.has("set-cookie"), false);
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), "event: ready\ndata: {}\n\n");
  streamController.close();
  await reader.cancel();
});
