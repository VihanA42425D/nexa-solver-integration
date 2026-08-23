import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Interface, getAddress } from "ethers";

const readJson = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const fixtures = await readJson("../../fixtures/nexa-v6-events.json");
const config = await readJson("../../nexa-v6-indexing.json");

function normalizedValue(type, value) {
  if (type === "address") return getAddress(value).toLowerCase();
  if (type.startsWith("uint") || type.startsWith("int")) return value.toString();
  if (type.startsWith("bytes")) return String(value).toLowerCase();
  return value;
}

function normalizeFixture(fixture) {
  const event = config.events[fixture.eventName];
  const iface = new Interface([event.abi]);
  const parsed = iface.parseLog({ topics: fixture.topics, data: fixture.data });
  const normalized = Object.fromEntries(parsed.fragment.inputs.map((input, index) => [
    input.name, normalizedValue(input.type, parsed.args[index]),
  ]));
  if (fixture.eventName === "StandardModuleConfiguredV6") {
    const standardId = normalized.standardId;
    normalized.standardKind = standardId === config.standards.erc7683.standardId
      ? "ERC_7683_EXECUTABLE"
      : (standardId === config.standards.oif.standardId
        ? "OIF_DISCOVERY_DESCRIPTION_ONLY" : "UNKNOWN");
  }
  return normalized;
}

test("shared Graph fixture decoder normalizes every canonical V6 log", () => {
  for (const fixture of fixtures.fixtures) {
    assert.deepEqual(normalizeFixture(fixture), fixture.expectedNormalized, fixture.fixtureId);
  }
});

test("Graph fixture projection preserves deterministic chain/block/transaction identity", () => {
  for (const fixture of fixtures.fixtures) {
    const provenance = {
      chainId: fixture.provenance.chainId,
      blockNumber: fixture.provenance.blockNumber,
      blockTimestamp: fixture.provenance.blockTimestamp,
      transactionHash: fixture.provenance.transactionHash,
      logIndex: fixture.provenance.logIndex,
    };
    assert.deepEqual(provenance, fixture.provenance);
    assert.equal(
      fixture.provenance.chainId + ":" + fixture.provenance.transactionHash
        + ":" + fixture.provenance.logIndex,
      "8453:" + fixture.provenance.transactionHash + ":" + fixture.provenance.logIndex,
    );
  }
});

test("event-only route state reconstructs registration and generation transitions", () => {
  const route = {};
  for (const fixture of fixtures.fixtures) {
    const value = normalizeFixture(fixture);
    if (fixture.eventName === "RouteRegisteredV6") Object.assign(route, value, { status: "1", generation: "1" });
    if (fixture.eventName === "RouteStatusChangedV6") Object.assign(route, {
      routeId: value.routeId, status: value.status, generation: value.generation,
    });
  }
  assert.equal(route.routeId, fixtures.fixtures.find((item) => item.fixtureId === "route-registered")
    .expectedNormalized.routeId);
  assert.equal(route.status, "2");
  assert.equal(route.generation, "2");
});

test("module fixtures preserve truthful ERC-7683 and OIF classifications", () => {
  const modules = fixtures.fixtures.filter((fixture) => fixture.eventName === "StandardModuleConfiguredV6")
    .map(normalizeFixture);
  assert.deepEqual(modules.map((module) => module.standardKind), [
    "ERC_7683_EXECUTABLE", "OIF_DISCOVERY_DESCRIPTION_ONLY",
  ]);
  assert.notEqual(modules[0].module, "0x0000000000000000000000000000000000000000");
  assert.notEqual(modules[1].module, "0x0000000000000000000000000000000000000000");
});
