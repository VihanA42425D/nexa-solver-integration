import test from "node:test";
import assert from "node:assert/strict";
import { Interface, id } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

test("all mainnet deployments expose the same deterministic solver surface", async () => {
  const networks = await Promise.all(["base", "bsc", "hyperevm"].map(loadPublicSurface));
  assert.deepEqual(networks.map(({ network }) => network.chainId), [8453, 56, 999]);
  for (const key of [
    "registry",
    "router",
    "reservationCoordinator",
    "currentErc7683Resolver",
    "resolverHubDelegate",
    "legacy7683Adapter",
    "oifAdapter",
    "solverLaneFactory",
  ]) {
    assert.equal(new Set(networks.map(({ network }) => network.contracts[key])).size, 1);
  }
});

test("standard IDs and minimal ABIs are self-consistent", async () => {
  const surface = await loadPublicSurface("base");
  for (const standard of Object.values(surface.standards.standards)) {
    assert.equal(id(standard.name), standard.id);
  }
  assert.ok(new Interface(surface.abis.registry).getFunction("getActiveSemanticRoutes"));
  assert.ok(new Interface(surface.abis.coordinator).getEvent("ReservationRequestedV5"));
  assert.ok(new Interface(surface.abis.currentResolver).getFunction("resolve"));
  assert.ok(new Interface(surface.abis.legacy7683).getFunction("open"));
  assert.ok(new Interface(surface.abis.solverLaneFactory).getFunction("createLane"));
  assert.ok(new Interface(surface.abis.oif).getFunction("fill"));
});
