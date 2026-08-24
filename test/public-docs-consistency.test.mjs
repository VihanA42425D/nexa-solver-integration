import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("public Smart Contracts reference matches canonical ABI, events, standards, and Facade evidence", async () => {
  const [document, solverAbi, events, standards, facadeEvidence] = await Promise.all([
    readFile("docs/Smart-Contracts.md", "utf8"),
    readJson("abi/solver-facing.json"),
    readJson("events/events.json"),
    readJson("standards/nexa-standards.json"),
    readJson("verification/facade-deployment.json"),
  ]);

  const registryAbi = solverAbi.contracts.NexaMainnetRegistryV6.abi.join("\n");
  for (const method of ["getRoute(bytes32 routeId)", "routeCount()", "routeAt(uint256 index)"]) {
    assert.ok(registryAbi.includes(`function ${method}`));
    assert.ok(document.includes(`\`${method.split("(")[0]}(`));
  }
  for (const unsupported of ["getRoutes()", "getRouteCount()", "interfaceVersion()", "getFillStatus(bytes32 fillId)"]) {
    assert.ok(!document.includes(unsupported), `unsupported public method documented: ${unsupported}`);
  }

  const sourceFill = events.events.SourceFillV6;
  assert.equal(sourceFill.contract, "NexaMainnetRouterV6");
  assert.ok(document.includes(`**SourceFillV6** (\`${sourceFill.contract}\`)`));
  assert.ok(document.includes(`Signature: \`${sourceFill.signature}\``));
  assert.ok(document.includes(`Topic 0: \`${sourceFill.topic0}\``));
  for (const field of sourceFill.indexed) assert.ok(document.includes(`\`${field}\``));

  assert.equal(standards.standards.erc7683.compatibilityLevel, "EXECUTABLE_RESOLVER");
  assert.ok(document.includes("`EXECUTABLE_RESOLVER`"));
  assert.ok(!/fully compliant with ERC-7683/i.test(document));
  assert.ok(!/All contracts implement ERC-165/i.test(document));
  assert.match(document, /ERC-7683 and OIF standards modules expose ERC-165/);

  assert.ok(!/All contracts verified on Sourcify/i.test(document));
  assert.match(document, /Facade verification/);
  for (const network of Object.values(facadeEvidence.networks)) {
    assert.ok(document.includes(String(network.deploymentBlockNumber)));
    assert.ok(document.includes(network.sourcify.url));
  }
});
