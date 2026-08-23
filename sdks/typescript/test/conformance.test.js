import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  NexaV6Client,
  canonicalJson,
  computeFeedHash,
  requestPermitMessage,
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
