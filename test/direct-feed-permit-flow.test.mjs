import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("direct example verifies Signed Feed then reaches Permit without Route Detail", async () => {
  const source = await readFile(
    new URL("../examples/direct-feed-to-permit.mjs", import.meta.url),
    "utf8",
  );
  const feed = source.indexOf('readJson("/api/v6/solver-feed")');
  const verify = source.indexOf("verifyV6RouteFeed(feed");
  const select = source.indexOf("const signedRoutes");
  const message = source.indexOf('readJson("/api/v6/execution-permits/request-message"');
  const permit = source.indexOf('readJson("/api/v6/execution-permits"');
  assert(feed >= 0 && feed < verify && verify < select && select < message && message < permit);
  assert.equal(source.includes("/api/v6/routes/"), false);
  assert.match(source, /feed\.actionableRoutes/);
  assert.match(source, /feed\.signedPayload\.routes/);
});
