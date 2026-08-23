import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const operations = [
  ["GET", "/.well-known/nexa-solver.json", "getWellKnownDiscovery", "Discovery"],
  ["GET", "/.well-known/nexa-onchain-discovery.json", "getOnchainDiscoveryFingerprint", "OnchainDiscoveryFingerprint"],
  ["GET", "/api/v6/solver-discovery", "getSolverDiscovery", "Discovery"],
  ["GET", "/api/v6/solver-feed", "getSignedSolverFeed", "FeedResponse"],
  ["GET", "/api/v6/solver-feed/events", "streamSignedSolverFeed", "SSE"],
  ["GET", "/api/v6/routes/{routeId}", "getRouteDetail", "JsonObject"],
  ["POST", "/api/v6/execution-permits/request-message", "buildPermitRequestMessage", "JsonObject"],
  ["POST", "/api/v6/execution-permits", "createExecutionPermit", "JsonObject"],
  ["GET", "/api/v6/execution-permits/{fillId}", "getExecutionPermit", "JsonObject"],
];
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

export function buildOpenApi() {
  const paths = {};
  for (const [method, path, operationId, responseName] of operations) {
    const operation = { operationId, responses: {} };
    if (responseName === "SSE") {
      operation.responses["200"] = {
        description: "SSE events: feed, publication-closed and error.",
        content: { "text/event-stream": { schema: { type: "string" } } },
      };
    } else {
      operation.responses["200"] = {
        description: "Successful response.",
        content: { "application/json": { schema: ref(responseName) } },
      };
    }
    operation.responses.default = { $ref: "#/components/responses/Error" };
    if (path.includes("{routeId}")) operation.parameters = [{
      name: "routeId", in: "path", required: true, schema: ref("Bytes32"),
    }];
    if (path.includes("{fillId}")) operation.parameters = [{
      name: "fillId", in: "path", required: true, schema: ref("Bytes32"),
    }];
    if (path.endsWith("/solver-feed")) operation.parameters = [
      { name: "sourceChainId", in: "query", schema: { type: "integer", minimum: 1 } },
      { name: "sourceNetworkId", in: "query", schema: ref("Bytes32") },
    ];
    if (method === "POST") {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: ref(
          path.endsWith("/request-message") ? "PermitRequest" : "SignedPermitRequest",
        ) } },
      };
    }
    if (path.endsWith("/execution-permits")) operation.parameters = [{
      name: "Idempotency-Key", in: "header", required: true,
      schema: { type: "string", minLength: 1 },
    }];
    paths[path] = { [method.toLowerCase()]: operation };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Nexa Mainnet V6 Solver API",
      version: "6.0.0",
      description: "Public discovery, signed Feed, SSE, Route and execution Permit API.",
    },
    servers: [{ url: "https://solver.vsnexa.com" }],
    paths,
    components: {
      schemas: {
        Bytes32: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        Address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        JsonObject: { type: "object", additionalProperties: true },
        Discovery: {
          type: "object",
          required: ["schema", "deploymentVersion", "deploymentStatus", "releaseId", "feedSigner", "endpoints"],
          properties: {
            schema: { const: "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2" },
            deploymentVersion: { const: 6 },
            deploymentStatus: { const: "ACTIVE" },
            releaseId: ref("Bytes32"),
            feedSigner: ref("Address"),
            endpoints: ref("JsonObject"),
            standards: { type: "array", items: ref("JsonObject") },
          },
        },
        OnchainDiscoveryFingerprint: {
          type: "object",
          required: [
            "schema", "protocol", "chains", "sameAddressAcrossChains", "facade",
            "facadeRuntimeCodeHash", "selectors", "events", "erc7683", "deployment",
          ],
          properties: {
            schema: { const: "NEXA_MAINNET_V6_ONCHAIN_DISCOVERY_FINGERPRINT_V1" },
            protocol: { const: "Nexa V6" },
            chains: { type: "array", prefixItems: [{ const: 8453 }, { const: 56 }, { const: 999 }] },
            sameAddressAcrossChains: { const: true },
            facade: ref("Address"),
            facadeRuntimeCodeHash: ref("Bytes32"),
            selectors: ref("JsonObject"),
            events: ref("JsonObject"),
            erc7683: ref("JsonObject"),
            deployment: ref("JsonObject"),
          },
          additionalProperties: true,
        },
        Route: {
          type: "object",
          required: ["routeId", "quoteId", "sourceNetworkId", "destinationNetworkId"],
          properties: {
            routeId: ref("Bytes32"), quoteId: ref("Bytes32"),
            sourceNetworkId: ref("Bytes32"), destinationNetworkId: ref("Bytes32"),
          },
          additionalProperties: true,
        },
        SignedFeed: {
          type: "object",
          required: ["schema", "feedHash", "feedSigner", "feedSignature", "validUntil", "routes"],
          properties: {
            schema: { const: "NEXA_MAINNET_V6_SIGNED_FEED_V1" },
            feedHash: ref("Bytes32"), feedSigner: ref("Address"),
            feedSignature: { type: "string", pattern: "^0x[0-9a-fA-F]+$" },
            validUntil: { type: "integer" },
            routes: { type: "array", items: ref("Route") },
          },
        },
        FeedResponse: {
          type: "object", required: ["ok", "feed"],
          properties: { ok: { const: true }, feed: ref("SignedFeed") },
        },
        PermitRequest: {
          type: "object",
          required: ["quoteId", "requestedAmountInRaw", "standard", "payer", "recipient", "idempotencyKey"],
          properties: {
            quoteId: ref("Bytes32"),
            requestedAmountInRaw: { type: "string", pattern: "^[0-9]+$" },
            standard: { type: "string", enum: ["DIRECT", "ERC-7683", "OIF"] },
            payer: ref("Address"), recipient: ref("Address"),
            idempotencyKey: { type: "string", minLength: 1 },
          },
        },
        SignedPermitRequest: {
          allOf: [
            ref("PermitRequest"),
            { type: "object", required: ["requestSignature"], properties: {
              requestSignature: { type: "string", pattern: "^0x[0-9a-fA-F]+$" },
            } },
          ],
        },
        Error: {
          type: "object", required: ["ok", "error"],
          properties: { ok: { const: false }, error: { type: "string" } },
        },
      },
      responses: {
        Error: {
          description: "Request rejected or publication gate closed.",
          content: { "application/json": { schema: ref("Error") } },
        },
      },
    },
  };
}

export async function generateOpenApi(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "openapi/openapi.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(buildOpenApi(), null, 2) + "\n");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateOpenApi());
}
