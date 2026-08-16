import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Interface, id } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";
import { auditRepositoryForSecrets } from "../scripts/repo-secret-audit.mjs";

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

test("reservation polling backs off when idle and accelerates on activity", async () => {
  const config = JSON.parse(await readFile(
    new URL("../config/example.config.json", import.meta.url),
    "utf8",
  ));
  const polling = config.reservationPolling;
  assert.equal(polling.idleIntervalMs, 30_000);
  assert.ok(polling.activityIntervalMs >= 1_000 && polling.activityIntervalMs <= 3_000);
  assert.ok(polling.backlogIntervalMs >= 1_000 && polling.backlogIntervalMs <= 3_000);
  assert.ok(polling.idleIntervalMs > polling.activityIntervalMs);
  assert.ok(polling.idleIntervalMs > polling.backlogIntervalMs);
});

test("secret audit covers files outside src and examples", async (context) => {
  const repository = await mkdtemp(join(tmpdir(), "nexa-public-audit-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(join(repository, "config"));
  const syntheticToken = ["ghp", "_", "A".repeat(36)].join("");
  await writeFile(join(repository, "config", "leak.txt"), "token=" + syntheticToken);
  await assert.rejects(
    auditRepositoryForSecrets(repository),
    /Potential GitHub access token detected in config\/leak\.txt/,
  );
});
