import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AbiCoder, Interface, id } from "ethers";
import { buildOpenApi } from "../scripts/generate-openapi.mjs";
import { buildOnchainDiscovery } from "../scripts/generate-onchain-discovery.mjs";
import { buildStandardsManifest } from "../scripts/generate-standards-manifest.mjs";
import { buildStandardVectors } from "../scripts/generate-standard-vectors.mjs";
import {
  PUBLIC_ENDPOINTS,
  PUBLIC_PATHS,
  allowedMethodsForPath,
} from "../src/public-endpoints.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const PERMIT_TUPLE = "tuple(bytes32 releaseId,bytes32 fillId,bytes32 routeId,bytes32 quoteId,bytes32 policyHash,bytes32 permitNonce,bytes32 sourceNetworkId,bytes32 sourceAssetId,bytes32 destinationNetworkId,bytes32 destinationAssetId,bytes32 sourceVaultAccountId,bytes32 destinationVaultAccountId,bytes32 payerAccountId,bytes32 recipientAccountId,uint64 dataVersion,bytes32 executionGeneration,uint64 validAfter,uint64 validUntil,uint32 sourceFinalityBlocks,uint32 settlementWindowSeconds,uint256 sourceChainId,uint256 destinationChainId,address sourceAsset,address destinationAsset,address sourceVault,address destinationVault,address sourceRouter,address payer,address recipient,uint128 amountInRaw,uint128 amountOutRaw)";

test("OpenAPI is the complete generated runtime projection with concrete critical schemas", () => {
  const openapi = buildOpenApi();
  assert.strictEqual(openapi, buildOpenApi());
  assert.equal(Object.isFrozen(openapi), true);
  assert.equal(openapi.openapi, "3.1.0");
  assert.deepEqual(Object.keys(openapi.paths), Object.values(PUBLIC_PATHS));
  for (const name of [
    "SolverDiscovery", "OnchainDiscoveryFingerprint", "ScannerHints", "StandardsManifest",
    "SignedFeed", "SignedFeedPayload", "FeedResponse", "Route", "RouteDetailResponse",
    "PermitRequest", "PermitRequestMessageResponse", "ExecutionPermitResponse",
    "PermitStatusResponse", "ErrorResponse",
  ]) assert.ok(openapi.components.schemas[name], name);
  assert.equal(
    openapi.components.schemas.SignedFeed.properties.signedPayload.$ref,
    "#/components/schemas/SignedFeedPayload",
  );
  assert.match(openapi.components.schemas.SignedFeed.description, /only signed authority/i);
  assert.equal(
    openapi.components.schemas.SignedFeed.properties.routeDetailTemplate.const,
    PUBLIC_ENDPOINTS.routeDetailTemplate,
  );
  assert.ok(openapi.components.schemas.SignedFeed.required.includes("routeDetailTemplate"));
  assert.match(
    openapi.components.schemas.SignedFeed.properties.routeDetailTemplate.description,
    /not part of signedPayload/i,
  );
  assert.equal(
    Object.hasOwn(openapi.components.schemas.SignedFeedPayload.properties, "routeDetailTemplate"),
    false,
  );
  for (const field of ["routeDetailTemplate", "routeDetailUrl", "nextAction", "actions"]) {
    assert.equal(Object.hasOwn(openapi.components.schemas.Route.properties, field), false);
  }
  assert.equal(
    openapi.components.schemas.RouteDetailResponse.properties.route.$ref,
    "#/components/schemas/Route",
  );
  assert.equal(
    openapi.components.schemas.RouteDetailResponse.properties.metrics.$ref,
    "#/components/schemas/RouteMetrics",
  );
  assert.equal(
    openapi.components.schemas.DirectExecution.properties.transactionCount.const,
    1,
  );
  assert.equal(
    openapi.components.schemas.ExecutionPermitEnvelope.properties.totalTransactionCount.const,
    2,
  );
  assert.deepEqual([...allowedMethodsForPath(PUBLIC_PATHS.openapi)], ["GET"]);
  assert.deepEqual([...allowedMethodsForPath(PUBLIC_PATHS.standards)], ["GET"]);
  assert.deepEqual(
    openapi.components.schemas.Route.properties.publicationLane.enum,
    ["L1", "L2", "L3", "L4"],
  );
  assert.deepEqual(
    openapi.components.schemas.DirectExecution.required,
    ["schema", "target", "function", "transactionCount", "inventory", "pricing"],
  );
  assert.equal(
    openapi.paths[PUBLIC_PATHS.executionPermits].post.requestBody
      .content["application/json"].schema.allOf[1].required[0],
    "requestSignature",
  );
});

test("SSE contract documents current-state Last-Event-ID behavior without replay or polling", () => {
  const stream = buildOpenApi().paths[PUBLIC_PATHS.solverFeedEvents].get;
  assert.match(stream.description, /no replay and no polling/i);
  assert.match(stream.description, /No Last-Event-ID sends current immediately/);
  assert.match(stream.description, /older ID sends current immediately/);
  assert.match(stream.description, /equal to current suppresses the initial event/);
  assert.match(stream.description, /invalid ID is ignored and current is sent/);
  assert.deepEqual(Object.keys(stream.responses["200"]["x-nexa-events"]), [
    "feed", "publication-closed", "error",
  ]);
  assert.equal(
    stream.responses["200"]["x-nexa-events"].error.schema.$ref,
    "#/components/schemas/SseErrorEvent",
  );
});

test("scanner hints remain an additive passive zero-write projection", async () => {
  const fingerprint = await buildOnchainDiscovery();
  const hints = fingerprint.scannerHints;
  assert.equal(hints.schema, "NEXA_MAINNET_V6_SCANNER_HINTS_V1");
  assert.equal(hints.generatedFrom, "CANONICAL_ONCHAIN_DISCOVERY_FINGERPRINT");
  assert.equal(hints.probe.externalScannerOnly, true);
  assert.equal(hints.probe.executedByNexa, false);
  assert.equal(hints.probe.performsWrites, false);
  assert.equal(hints.probe.pollingRequired, false);
  assert.deepEqual(hints.supportedChainIds, [8453, 56, 999]);
  assert.equal(hints.probe.steps.length, 9);
  assert.deepEqual(
    hints.eventDiscovery.SourceFillV6.indexedTopicPositions,
    { fillId: 1, routeId: 2, quoteId: 3 },
  );
});

test("standards manifest advertises exactly one ERC-7683 Call and discovery-only OIF", async () => {
  const manifest = await buildStandardsManifest();
  const erc = manifest.standards.erc7683;
  const oif = manifest.standards.oif;
  assert.equal(erc.resolutionTransport, "OFFCHAIN_ETH_CALL");
  assert.equal(erc.resolve.transactionCount, 0);
  assert.equal(erc.resolve.stepCount, 1);
  assert.equal(erc.resolve.stepType, "Call");
  assert.equal(erc.resolve.target, manifest.router.address);
  assert.equal(erc.resolve.function, "fillDirect");
  assert.deepEqual(
    erc.resolveExecution.outputFields,
    ["routeId", "quoteId", "target", "value", "callData"],
  );
  assert.equal(oif.compatibilityLevel, "DISCOVERY_DESCRIPTION_ONLY");
  assert.equal(oif.executable, false);
  assert.equal(oif.resolveExecution.supported, false);
  assert.equal(oif.resolveExecution.revertsWith, "OIFExecutionUnsupported()");
  for (const standard of [erc, oif]) {
    for (const [name, signature] of Object.entries(standard.selectorSignatures)) {
      assert.equal(standard.selectors[name], id(signature).slice(0, 10));
    }
    assert.equal(standard.erc165.interfaceIds[0], id("supportsInterface(bytes4)").slice(0, 10));
  }
  const moduleInterfaceId = (
    Number.parseInt(id("standardId()").slice(2, 10), 16)
    ^ Number.parseInt(id("resolveExecution(bytes)").slice(2, 10), 16)
  ) >>> 0;
  assert.equal(erc.erc165.interfaceIds[1], `0x${moduleInterfaceId.toString(16).padStart(8, "0")}`);
  assert.equal(oif.erc165.interfaceIds[1], erc.erc165.interfaceIds[1]);
  assert.deepEqual(manifest.executionInvariant, {
    botSourceTransactions: 1,
    nexaDestinationTransactions: 1,
    totalTransactions: 2,
  });
});

test("standard vectors deterministically derive a valid ABI payload from the SDK vector", async () => {
  const vector = await buildStandardVectors();
  const [permit, signature] = AbiCoder.defaultAbiCoder().decode(
    [PERMIT_TUPLE, "bytes"],
    vector.payload.value,
  );
  assert.equal(permit.fillId, vector.payload.permit.fillId);
  assert.equal(signature, vector.payload.permitSignature);
  const erc = new Interface([
    "function resolve(bytes payload) view returns (tuple(bytes[] steps,bytes[] variables,bytes[] payments,tuple(string name,bytes data)[] assumptions) order)",
  ]);
  const decodedResolve = erc.decodeFunctionData(
    "resolve",
    vector.erc7683.resolve.ethCall.data,
  );
  assert.equal(decodedResolve.payload, vector.payload.value);
  assert.equal(vector.erc7683.resolve.expected.stepCount, 1);
  assert.equal(vector.erc7683.resolveExecution.expected.sourceTransactionCount, 1);
  const router = new Interface([`function fillDirect(${PERMIT_TUPLE} permit,bytes signature)`]);
  assert.equal(
    vector.erc7683.resolveExecution.expected.callData.slice(0, 10),
    router.getFunction("fillDirect").selector,
  );
  assert.equal(
    vector.erc7683.resolveExecution.expected.target,
    vector.payload.permit.sourceRouter,
  );
  assert.equal(vector.oif.executable, false);
  assert.equal(
    vector.oif.resolveExecution.expected.revertsWith,
    "OIFExecutionUnsupported()",
  );
});

test("existing standard examples are explicit eth_call-only clients", async () => {
  const erc = await readFile(new URL("../examples/resolve-erc7683.mjs", import.meta.url), "utf8");
  const oif = await readFile(new URL("../examples/describe-oif-mandate.mjs", import.meta.url), "utf8");
  assert.match(erc, /resolve\.staticCall\(payload\)/);
  assert.match(erc, /transactionCount: 0/);
  assert.match(oif, /describeMandate\.staticCall\(payload\)/);
  assert.match(oif, /executable: false/);
  for (const source of [erc, oif]) {
    assert.doesNotMatch(source, /Wallet|sendTransaction|broadcastTransaction/);
  }
});

test("checked-in standards artifacts are exact generated projections", async () => {
  assert.deepEqual(
    await readJson("../standards/nexa-standards.json"),
    await buildStandardsManifest(),
  );
  assert.deepEqual(
    await readJson("../standards/test-vectors.json"),
    await buildStandardVectors(),
  );
  assert.equal(PUBLIC_ENDPOINTS.openapi, "https://solver.vsnexa.com/openapi.json");
  assert.equal(
    PUBLIC_ENDPOINTS.standards,
    "https://solver.vsnexa.com/.well-known/nexa-standards.json",
  );
});
