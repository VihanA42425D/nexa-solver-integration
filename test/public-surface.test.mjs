import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { id } from "ethers";
import { isActiveV6Bundle, loadPublicSurface } from "../src/load-public-surface.mjs";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";
import { auditRepositoryForSecrets } from "../scripts/repo-secret-audit.mjs";

test("deployed-awaiting-cutover V6 bundle is fail-closed and publishes no partial addresses", async () => {
  const surface = await loadPublicSurface(null, { requireActive: false });
  assert.equal(surface.active, false);
  assert.equal(surface.manifest.deploymentVersion, 6);
  assert.equal(surface.integration.deploymentStatus, "DEPLOYED_AWAITING_CUTOVER");
  assert.equal(surface.integration.activationRequired, true);
  assert.equal(surface.integration.doNotUseForExecutionUntilActivated, true);
  assert.deepEqual(surface.integration.contracts, {});
  assert.deepEqual(surface.integration.networks, {});
  await assert.rejects(loadPublicSurface(), /NEXA_V6_PUBLIC_BUNDLE_NOT_ACTIVATED/);
});

test("deployed-awaiting-cutover status cannot be promoted by partial activation fields", () => {
  assert.equal(isActiveV6Bundle({
    deploymentVersion: 6,
    releaseId: "0x" + "11".repeat(32),
    deploymentStatus: "DEPLOYED_AWAITING_CUTOVER",
    activationRequired: false,
    doNotUseForExecutionUntilActivated: false,
    contracts: { RouterV6: {} },
    networks: { base: {} },
  }), false);
});

test("public Solver profile advertises both execution scopes without exposing an internal settlement model", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.solverProfile.executionScopes, ["INTRA_CHAIN", "CROSS_CHAIN"]);
  assert.equal(manifest.solverProfile.automatedDiscovery, true);
  assert.equal(manifest.solverProfile.variableSizeExecution, true);
  assert.equal(manifest.solverProfile.amountBoundSignedTerms, true);
  assert.equal(manifest.solverProfile.executableCapacityPublished, true);
  assert.equal(manifest.solverProfile.machineVerifiableState, true);
  assert.equal(manifest.solverProfile.lowProtocolOverhead, true);
  assert.equal(manifest.solverProfile.periodicOnchainPublicationRequired, false);
  assert.equal(manifest.solverProfile.loginRequired, false);
  assert.equal(manifest.solverProfile.sessionRequired, false);
  assert.equal(manifest.solverProfile.cookieRequired, false);
  assert.equal(Object.hasOwn(manifest, "executionModel"), false);
  assert.equal(Object.hasOwn(manifest, "deprecated"), false);
});

test("standard IDs and V6 event topics are self-consistent", async () => {
  const surface = await loadPublicSurface(null, { requireActive: false });
  for (const standard of Object.values(surface.standards.standards)) {
    assert.equal(id(standard.name), standard.id);
  }
  for (const event of Object.values(surface.events.events)) {
    assert.equal(id(event.signature), event.topic0);
  }
  assert.equal(surface.standards.standards.erc7683.executionStepCount, 1);
  assert.equal(surface.standards.standards.oif.executable, false);
});

test("only V6 public endpoint catalog is exported", () => {
  assert.deepEqual(Object.values(PUBLIC_ENDPOINTS), [
    "https://solver.vsnexa.com/.well-known/nexa-solver.json",
    "https://solver.vsnexa.com/api/v6/solver-discovery",
    "https://solver.vsnexa.com/api/v6/solver-feed",
    "https://solver.vsnexa.com/api/v6/solver-feed/events",
    "https://solver.vsnexa.com/api/v6/routes/{routeId}",
    "https://solver.vsnexa.com/api/v6/execution-permits/request-message",
    "https://solver.vsnexa.com/api/v6/execution-permits",
    "https://solver.vsnexa.com/api/v6/execution-permits/{fillId}"
  ]);
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
