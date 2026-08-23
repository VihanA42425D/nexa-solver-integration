import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  NexaV6Client,
  canonicalJson,
  computeFeedHash,
  requestPermitMessage,
  SDK_HEADER_VALUE,
  verifyFeed,
} from "../src/index.js";

const vectors = JSON.parse(await readFile(
  new URL("../../../sdk-spec/test-vectors.json", import.meta.url),
  "utf8",
));

test("canonical JSON and Feed verification match frozen vectors", () => {
  assert.equal(
    canonicalJson(vectors.canonicalJson.input),
    vectors.canonicalJson.expected,
  );
  assert.equal(
    computeFeedHash(vectors.feed.signedPayload),
    vectors.feed.feedHash,
  );
  const result = verifyFeed({
    signedPayload: vectors.feed.signedPayload,
    feedHash: vectors.feed.feedHash,
    feedSigner: vectors.feed.feedSigner,
    feedSignature: vectors.feed.feedSignature,
  }, {
    expectedSigner: vectors.feed.feedSigner,
    nowSeconds: vectors.feed.nowSeconds,
    required: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.recoveredSigner, vectors.feed.feedSigner);
});

test("Permit message and execution calldata match frozen vectors", () => {
  assert.equal(
    requestPermitMessage(vectors.permitRequest.request),
    vectors.permitRequest.expectedMessage,
  );
  const client = new NexaV6Client({ fetch: async () => new Response("{}") });
  const transaction = client.buildExecutionTx({
    permit: vectors.abi.permit,
    permitSignature: vectors.abi.permitSignature,
    execution: { target: vectors.abi.executionTarget },
  });
  assert.equal(transaction.data, vectors.abi.fillDirectCallData);
  assert.equal(transaction.value, vectors.abi.expectedTransactionValue);
});

test("all frozen behavioral operations are present", () => {
  const client = new NexaV6Client({ fetch: async () => new Response("{}") });
  for (const name of [
    "discover", "getRoutes", "getRoute", "verifyFeed",
    "requestPermitMessage", "requestPermit", "resolveExecution",
    "previewExecution", "buildExecutionTx", "getFillStatus",
  ]) {
    assert.equal(typeof client[name], "function", name);
  }
});

test("public Nexa requests declare the SDK but RPC requests do not", async () => {
  const requests = [];
  const client = new NexaV6Client({
    fetch: async (_url, init) => {
      requests.push(init);
      return new Response(JSON.stringify({
        schema: "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2",
        deploymentVersion: 6,
        deploymentStatus: "ACTIVE",
        releaseId: `0x${"11".repeat(32)}`,
        feedSigner: "0x0000000000000000000000000000000000000001",
        endpoints: { solverFeed: "https://solver.vsnexa.com/api/v6/solver-feed" },
      }), { headers: { "content-type": "application/json" } });
    },
  });
  await client.discover();
  await assert.rejects(
    () => client.rpc("https://rpc.example", "eth_call", []),
    /NEXA_SDK_RPC_ERROR/,
  );
  assert.equal(new Headers(requests[0].headers).get("x-nexa-sdk"), SDK_HEADER_VALUE);
  assert.equal(new Headers(requests[1].headers).get("x-nexa-sdk"), null);
});
