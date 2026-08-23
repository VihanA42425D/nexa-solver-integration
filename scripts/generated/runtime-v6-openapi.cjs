// Generated projection of Nexa runtime libs/nexa/mainnet/v6OpenApi.js.
// Runtime repository is authoritative; regenerate this file instead of hand editing.
// @scope production-only
"use strict";

const V6_HTTP_PATHS = Object.freeze({
  manifest: "/.well-known/nexa-solver.json",
  onchainDiscovery: "/.well-known/nexa-onchain-discovery.json",
  openapi: "/openapi.json",
  standards: "/.well-known/nexa-standards.json",
  solverDiscovery: "/api/v6/solver-discovery",
  solverFeed: "/api/v6/solver-feed",
  solverFeedEvents: "/api/v6/solver-feed/events",
  routeDetailTemplate: "/api/v6/routes/{routeId}",
  permitRequestMessage: "/api/v6/execution-permits/request-message",
  executionPermits: "/api/v6/execution-permits",
  permitStatusTemplate: "/api/v6/execution-permits/{fillId}",
});
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const str = (pattern, description, extra = {}) => ({
  type: "string", ...(pattern ? { pattern } : {}), ...(description ? { description } : {}), ...extra,
});
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonResponse = (schema, description) => ({
  description,
  content: { "application/json": { schema } },
});
const ADDRESS = str("^0x[0-9a-fA-F]{40}$", "EVM address.");
const BYTES32 = str("^0x[0-9a-fA-F]{64}$", "32-byte hexadecimal value.");
const SELECTOR = str("^0x[0-9a-fA-F]{8}$", "Four-byte function selector.");
const UINT = str("^(?:0|[1-9][0-9]*)$", "Unsigned integer encoded as a base-10 string.");
const UNIX = { type: "integer", minimum: 0, description: "Unix timestamp in seconds." };
const LOCATOR = {
  type: "object",
  description: "Network-specific locator. Connector-defined keys are included in canonical JSON.",
  additionalProperties: true,
};

function errorResponses(codes) {
  const descriptions = {
    400: "Invalid request or filter.",
    404: "Resource not found.",
    409: "Idempotency, capacity, or inventory conflict.",
    410: "Quote is no longer open or has expired.",
    413: "Request body exceeds 32 KiB.",
    429: "Permit request rate limited.",
    500: "Internal runtime error.",
    503: "Publication surface closed or required authority unavailable.",
  };
  return Object.fromEntries(codes.map((code) => [
    String(code), jsonResponse(ref("ErrorResponse"), descriptions[code]),
  ]));
}

function routeSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "dataVersion", "routeId", "quoteId", "sourceNetworkId", "sourceAssetId",
      "destinationNetworkId", "destinationAssetId", "sourceChainId", "destinationChainId",
      "sourceAsset", "destinationAsset", "sourceVault", "destinationVault", "sourceRouter",
      "sourceLocator", "destinationLocator", "discoveryStatus", "executionStatus",
      "permitAvailable", "publicationLane", "publicationRank", "serviceCategory", "feeMode",
      "serviceFeeBps", "sourceTokenDecimals", "destinationTokenDecimals", "pricingReferenceId",
      "executionGeneration", "sourceFinalityBlocks", "settlementWindowSeconds", "validAfter",
      "validUntil", "policyHash", "assumptionsHash", "legacyRouteId", "dailyStatus", "open",
      "pricingMode", "indicativePriceNumeratorRaw", "indicativePriceDenominatorRaw",
      "minimumFillInRaw", "maxAvailableInRaw",
    ],
    properties: {
      dataVersion: UINT, routeId: BYTES32, quoteId: BYTES32,
      sourceNetworkId: BYTES32, sourceAssetId: BYTES32,
      destinationNetworkId: BYTES32, destinationAssetId: BYTES32,
      sourceChainId: nullable(UINT), destinationChainId: nullable(UINT),
      sourceAsset: nullable(ADDRESS), destinationAsset: nullable(ADDRESS),
      sourceVault: nullable(ADDRESS), destinationVault: nullable(ADDRESS),
      sourceRouter: nullable(ADDRESS), sourceLocator: LOCATOR, destinationLocator: LOCATOR,
      discoveryStatus: { const: "DISCOVERABLE" },
      executionStatus: { enum: ["OPEN", "PAUSED", "TEMP_UNAVAILABLE"] },
      permitAvailable: { type: "boolean" }, publicationLane: { enum: ["L1", "L2", "L3", "L4"] },
      publicationRank: { type: "integer", minimum: 0 }, serviceCategory: { type: "string" },
      feeMode: { type: "string" }, serviceFeeBps: nullable({ type: "number", minimum: 0, maximum: 10000 }),
      sourceTokenDecimals: { type: "integer", minimum: 0, maximum: 78 },
      destinationTokenDecimals: { type: "integer", minimum: 0, maximum: 78 },
      pricingReferenceId: BYTES32, executionGeneration: BYTES32,
      sourceFinalityBlocks: { type: "integer", minimum: 1 },
      settlementWindowSeconds: { type: "integer", minimum: 1 },
      validAfter: UNIX, validUntil: UNIX, policyHash: BYTES32,
      assumptionsHash: nullable(BYTES32), legacyRouteId: nullable(BYTES32),
      dailyStatus: { enum: ["OPEN", "CLOSED"] }, open: { type: "boolean" },
      pricingMode: { const: "INDICATIVE_ENVELOPE_REPRICE_AT_PERMIT" },
      indicativePriceNumeratorRaw: UINT, indicativePriceDenominatorRaw: UINT,
      minimumFillInRaw: UINT, maxAvailableInRaw: UINT,
    },
  };
}

function feedSchemas() {
  return {
    SignedFeedPayload: {
      type: "object",
      additionalProperties: false,
      description: "Sole cryptographic authority: feedHash and feedSignature cover this complete unfiltered object.",
      required: ["schema", "releaseId", "dataVersion", "generatedAt", "validUntil", "routes"],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_SIGNED_FEED_V1" },
        releaseId: BYTES32, dataVersion: UINT, generatedAt: UNIX, validUntil: UNIX,
        routes: { type: "array", items: ref("Route") },
      },
    },
    SignedFeed: {
      type: "object",
      additionalProperties: false,
      description: "signedPayload is the only signed authority. Top-level routes/openRoutes are filterable convenience views and must not be substituted during verification.",
      required: [
        "schema", "releaseId", "dataVersion", "generatedAt", "validUntil", "signedPayload",
        "routes", "openRoutes", "feedHash", "feedSigner", "feedSignature", "publicationGasWei",
        "publicationTransactionHashes", "routeCount", "openRouteCount", "returnedRouteCount",
        "returnedOpenRouteCount",
      ],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_SIGNED_FEED_V1" },
        releaseId: BYTES32, dataVersion: UINT, generatedAt: UNIX, validUntil: UNIX,
        signedPayload: ref("SignedFeedPayload"),
        routes: { type: "array", items: ref("Route") },
        openRoutes: { type: "array", items: ref("Route") },
        feedHash: BYTES32, feedSigner: ADDRESS,
        feedSignature: str("^0x[0-9a-fA-F]{130}$"),
        publicationGasWei: { const: "0" },
        publicationTransactionHashes: { type: "array", maxItems: 0, items: BYTES32 },
        routeCount: { type: "integer", minimum: 0 }, openRouteCount: { type: "integer", minimum: 0 },
        returnedRouteCount: { type: "integer", minimum: 0 },
        returnedOpenRouteCount: { type: "integer", minimum: 0 },
      },
    },
    FeedResponse: {
      type: "object", additionalProperties: false, required: ["ok", "feed"],
      properties: { ok: { const: true }, feed: ref("SignedFeed") },
    },
  };
}

function permitSchemas() {
  return {
    PermitRequest: {
      type: "object",
      additionalProperties: false,
      required: ["quoteId", "requestedAmountInRaw", "idempotencyKey"],
      allOf: [
        { anyOf: [{ required: ["payer"] }, { required: ["payerAccountId", "payerLocator"] }] },
        { anyOf: [{ required: ["recipient"] }, { required: ["recipientAccountId", "recipientLocator"] }] },
      ],
      properties: {
        quoteId: BYTES32, requestedAmountInRaw: UINT,
        standard: str("^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$", "Defaults to DIRECT; canonical form is uppercase."),
        payer: ADDRESS, recipient: ADDRESS, payerAccountId: BYTES32, recipientAccountId: BYTES32,
        payerLocator: LOCATOR, recipientLocator: LOCATOR,
        idempotencyKey: str("^[a-zA-Z0-9._:-]{8,128}$"),
        requestSignature: {
          type: "string",
          description: "EIP-191 signature for EVM ownership, or connector ownership proof.",
        },
      },
    },
    PermitRequestMessageResponse: {
      type: "object", additionalProperties: false, required: ["ok", "message"],
      properties: {
        ok: { const: true },
        message: { type: "string", description: "Exact deterministic UTF-8 message to sign locally." },
      },
    },
    ExecutionPermit: {
      type: "object",
      additionalProperties: false,
      required: [
        "releaseId", "fillId", "permitNonce", "sourceNetworkId", "sourceAssetId",
        "destinationNetworkId", "destinationAssetId", "sourceVaultAccountId",
        "destinationVaultAccountId", "payerAccountId", "recipientAccountId", "routeId",
        "quoteId", "policyHash", "dataVersion", "executionGeneration", "validAfter",
        "validUntil", "sourceFinalityBlocks", "settlementWindowSeconds", "sourceChainId",
        "destinationChainId", "sourceAsset", "destinationAsset", "sourceVault",
        "destinationVault", "sourceRouter", "payer", "recipient", "amountInRaw", "amountOutRaw",
        "publicationLane", "serviceCategory", "feeMode", "serviceFeeBps",
      ],
      properties: {
        releaseId: BYTES32, fillId: BYTES32, permitNonce: BYTES32,
        sourceNetworkId: BYTES32, sourceAssetId: BYTES32,
        destinationNetworkId: BYTES32, destinationAssetId: BYTES32,
        sourceVaultAccountId: BYTES32, destinationVaultAccountId: BYTES32,
        payerAccountId: BYTES32, recipientAccountId: BYTES32,
        routeId: BYTES32, quoteId: BYTES32, policyHash: BYTES32,
        dataVersion: UINT, executionGeneration: BYTES32, validAfter: UINT, validUntil: UINT,
        sourceFinalityBlocks: { type: "integer", minimum: 1 },
        settlementWindowSeconds: { type: "integer", minimum: 1 },
        sourceChainId: UINT, destinationChainId: UINT, sourceAsset: ADDRESS,
        destinationAsset: ADDRESS, sourceVault: ADDRESS, destinationVault: ADDRESS,
        sourceRouter: ADDRESS, payer: ADDRESS, recipient: ADDRESS,
        amountInRaw: UINT, amountOutRaw: UINT,
        publicationLane: { enum: ["L1", "L2", "L3", "L4"] },
        serviceCategory: { type: "string" }, feeMode: { type: "string" },
        serviceFeeBps: nullable({ type: "number" }),
      },
    },
    DirectExecution: {
      type: "object",
      additionalProperties: false,
      required: ["schema", "target", "function", "transactionCount", "inventory", "pricing"],
      properties: {
        schema: { const: "NEXA_V6_DIRECT_EXECUTION_V1" },
        target: ADDRESS, function: { const: "fillDirect" },
        transactionCount: { const: 1 },
        inventory: nullable({
          type: "object", additionalProperties: false,
          required: [
            "source", "snapshotId", "capturedAt", "ageMs", "physicalRaw",
            "effectiveLiabilityRaw", "effectiveAccountingHoldRaw", "activeClearingCommitmentRaw",
          ],
          properties: {
            source: { const: "V6_PERSISTED_INVENTORY_SNAPSHOT" },
            snapshotId: { type: "string" }, capturedAt: { type: "string", format: "date-time" },
            ageMs: { type: "integer", minimum: 0 }, physicalRaw: UINT,
            effectiveLiabilityRaw: UINT, effectiveAccountingHoldRaw: UINT,
            activeClearingCommitmentRaw: UINT,
          },
        }),
        pricing: {
          type: "object", additionalProperties: false,
          required: [
            "pricingMode", "modelVersion", "pricingReferenceId", "publicationLane",
            "serviceCategory", "feeMode", "serviceFeeBps", "snapshotId", "routeSnapshotId",
            "quoteObservedAt", "pricingCycleId", "pricingCycleObservedAt",
            "pricingCycleValidUntil", "payoutEconomicCeilingRequired",
            "payoutEconomicCeiling", "evidence", "executionCapacity",
          ],
          properties: {
            pricingMode: { const: "FRESH_AMOUNT_BOUND" }, modelVersion: nullable({ type: "string" }),
            pricingReferenceId: BYTES32,
            publicationLane: { enum: ["L1", "L2", "L3", "L4"] },
            serviceCategory: { type: "string" }, feeMode: { type: "string" },
            serviceFeeBps: nullable({ type: "number" }), snapshotId: { type: "string" },
            routeSnapshotId: nullable({ type: "string" }),
            quoteObservedAt: { type: "string", format: "date-time" },
            pricingCycleId: { type: "string" },
            pricingCycleObservedAt: nullable({ type: "string", format: "date-time" }),
            pricingCycleValidUntil: { type: "string", format: "date-time" },
            payoutEconomicCeilingRequired: { type: "boolean" },
            payoutEconomicCeiling: nullable({ type: "object", additionalProperties: true }),
            evidence: { type: "object", additionalProperties: true },
            executionCapacity: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    ExecutionPermitEnvelope: {
      type: "object",
      additionalProperties: false,
      required: [
        "fillId", "state", "idempotencyKey", "expiresAt", "permit", "permitDigest",
        "permitSignature", "execution", "totalTransactionCount", "sourceTxHash", "payoutTxHash",
        "publicationLane", "serviceCategory", "feeMode", "serviceFeeBps",
      ],
      properties: {
        fillId: BYTES32, state: { type: "string" }, idempotencyKey: { type: "string" },
        expiresAt: UNIX, permit: ref("ExecutionPermit"), permitDigest: BYTES32,
        permitSignature: str("^0x[0-9a-fA-F]{130}$"), execution: ref("DirectExecution"),
        totalTransactionCount: { const: 2 }, sourceTxHash: nullable(BYTES32),
        payoutTxHash: nullable(BYTES32),
        publicationLane: { enum: ["L1", "L2", "L3", "L4"] },
        serviceCategory: { type: "string" }, feeMode: { type: "string" },
        serviceFeeBps: nullable({ type: "number" }),
      },
    },
    ExecutionPermitResponse: {
      type: "object", additionalProperties: false, required: ["ok", "idempotent", "permit"],
      properties: {
        ok: { const: true }, idempotent: { type: "boolean" },
        permit: ref("ExecutionPermitEnvelope"),
      },
    },
    PermitStatusResponse: {
      type: "object", additionalProperties: false, required: ["ok", "permit"],
      properties: { ok: { const: true }, permit: ref("ExecutionPermitEnvelope") },
    },
  };
}

function scannerSchemas() {
  const scannerContract = {
    type: "object", additionalProperties: false,
    required: [
      "name", "role", "address", "expectedRuntimeCodeHash", "supportedChainIds",
      "sameAddressAcrossChains",
    ],
    properties: {
      name: { type: "string" }, role: { type: "string" }, address: ADDRESS,
      expectedRuntimeCodeHash: BYTES32,
      supportedChainIds: { type: "array", items: { type: "integer" } },
      sameAddressAcrossChains: { const: true },
    },
  };
  const scannerMethod = {
    type: "object", additionalProperties: false,
    required: ["contract", "address", "signature", "selector", "stateMutability", "returns"],
    properties: {
      contract: { type: "string" }, address: ADDRESS, signature: { type: "string" },
      selector: SELECTOR, stateMutability: { enum: ["pure", "view"] },
      returns: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["name", "type"],
          properties: { name: { type: "string" }, type: { type: "string" } },
        },
      },
    },
  };
  const scannerStep = {
    type: "object",
    additionalProperties: false,
    required: ["order", "id", "required"],
    properties: {
      order: { type: "integer", minimum: 1 }, id: { type: "string" },
      required: { type: "boolean" }, optional: { type: "boolean" },
      transport: { enum: ["JSON_RPC", "HTTPS"] },
      rpcMethod: { enum: ["eth_getCode", "eth_call", "eth_getLogs"] },
      operation: { type: "string" }, inputFromStep: { type: "string" },
      address: ADDRESS, supportedChainIds: { type: "array", items: { type: "integer" } },
      call: scannerMethod, topics: { type: "array", items: BYTES32 },
      method: { const: "GET" }, uriFromStep: { type: "string" },
      expected: { type: "object", additionalProperties: true },
    },
  };
  const sourceFillEvent = {
    type: "object", additionalProperties: false,
    required: [
      "emittingContract", "address", "supportedChainIds", "signature", "topic0",
      "indexedFields", "indexedTopicPositions", "nonIndexedFields", "discoveryMapping",
    ],
    properties: {
      emittingContract: { type: "string" }, address: ADDRESS,
      supportedChainIds: { type: "array", items: { type: "integer" } },
      signature: { type: "string" }, topic0: BYTES32,
      indexedFields: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["name", "type", "topicPosition"],
          properties: {
            name: { type: "string" }, type: { type: "string" },
            topicPosition: { type: "integer", minimum: 1, maximum: 3 },
          },
        },
      },
      indexedTopicPositions: {
        type: "object", additionalProperties: { type: "integer", minimum: 1, maximum: 3 },
      },
      nonIndexedFields: { type: "array", items: { type: "string" } },
      discoveryMapping: {
        type: "object", additionalProperties: false,
        required: ["router", "facade", "discoveryURI"],
        properties: { router: ADDRESS, facade: ADDRESS, discoveryURI: { type: "string", format: "uri" } },
      },
    },
  };
  const scannerStandard = {
    type: "object", additionalProperties: false,
    required: [
      "supportedChainIds", "standardId", "erc165InterfaceIds", "selectors",
      "selectorSignatures", "router", "expectedRuntimeCodeHash",
    ],
    properties: {
      resolver: ADDRESS, module: ADDRESS,
      supportedChainIds: { type: "array", items: { type: "integer" } },
      standardId: BYTES32, compatibilityLevel: BYTES32,
      compatibilityLevelName: { type: "string" }, executable: { type: "boolean" },
      erc165InterfaceIds: { type: "array", items: SELECTOR },
      selectors: { type: "object", additionalProperties: SELECTOR },
      selectorSignatures: { type: "object", additionalProperties: { type: "string" } },
      router: ADDRESS, expectedRuntimeCodeHash: BYTES32,
    },
  };
  return {
    ScannerHints: {
      type: "object", additionalProperties: false,
      required: [
        "schema", "generatedFrom", "protocol", "releaseId", "deploymentVersion", "status",
        "supportedChainIds", "sameAddressAcrossChains", "contracts", "probe",
        "eventDiscovery", "deterministicDeployment", "standards",
      ],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_SCANNER_HINTS_V1" },
        generatedFrom: { const: "CANONICAL_ONCHAIN_DISCOVERY_FINGERPRINT" },
        protocol: { const: "Nexa V6" }, releaseId: BYTES32,
        deploymentVersion: { const: 6 }, status: { const: "ACTIVE" },
        supportedChainIds: { type: "array", items: { type: "integer" } },
        sameAddressAcrossChains: { const: true },
        contracts: {
          type: "object", additionalProperties: false,
          required: ["facade", "registry", "router", "erc7683Resolver", "oifModule"],
          properties: {
            facade: scannerContract, registry: scannerContract, router: scannerContract,
            erc7683Resolver: scannerContract, oifModule: scannerContract,
          },
        },
        probe: {
          type: "object", additionalProperties: false,
          required: [
            "mode", "externalScannerOnly", "executedByNexa", "performsWrites",
            "pollingRequired", "methods", "steps",
          ],
          properties: {
            mode: { const: "EXTERNAL_SCANNER_READ_ONLY" },
            externalScannerOnly: { const: true }, executedByNexa: { const: false },
            performsWrites: { const: false }, pollingRequired: { const: false },
            methods: {
              type: "object", additionalProperties: false,
              required: ["discoveryURI", "isLive", "systemState", "routeCount"],
              properties: {
                discoveryURI: scannerMethod, isLive: scannerMethod,
                systemState: scannerMethod, routeCount: scannerMethod,
              },
            },
            steps: { type: "array", minItems: 9, maxItems: 9, items: scannerStep },
          },
        },
        eventDiscovery: {
          type: "object", additionalProperties: false, required: ["SourceFillV6"],
          properties: { SourceFillV6: sourceFillEvent },
        },
        deterministicDeployment: {
          type: "object", additionalProperties: false,
          required: [
            "method", "factory", "salt", "initCodeHash", "expectedFacadeAddress",
            "supportedChainIds", "deploymentBlocks", "deploymentTransactions",
            "sameAddressAcrossChains",
          ],
          properties: {
            method: { const: "CREATE2" }, factory: ADDRESS, salt: BYTES32,
            initCodeHash: BYTES32, expectedFacadeAddress: ADDRESS,
            supportedChainIds: { type: "array", items: { type: "integer" } },
            deploymentBlocks: { type: "object", additionalProperties: { type: "integer" } },
            deploymentTransactions: { type: "object", additionalProperties: BYTES32 },
            sameAddressAcrossChains: { const: true },
          },
        },
        standards: {
          type: "object", additionalProperties: false, required: ["erc7683", "oif"],
          properties: { erc7683: scannerStandard, oif: scannerStandard },
        },
      },
    },
  };
}

function standardsSchemas() {
  const payloadEncoding = {
    type: "object", additionalProperties: false,
    required: ["mediaType", "solidity", "tuple", "source"],
    properties: {
      mediaType: { const: "application/vnd.nexa.execution-permit-v6+abi" },
      solidity: { const: "abi.encode(ExecutionPermit,bytes)" },
      tuple: {
        type: "array",
        prefixItems: [
          { const: "NexaMainnetV6Types.ExecutionPermit permit" },
          { const: "bytes permitSignature" },
        ],
        minItems: 2, maxItems: 2,
      },
      source: { type: "string" },
    },
  };
  const resolution = {
    type: "object", additionalProperties: false,
    required: ["supported", "signature", "selector", "stateMutability", "transactionCount"],
    properties: {
      supported: { type: "boolean" }, signature: { type: "string" }, selector: SELECTOR,
      stateMutability: { enum: ["pure", "view"] }, ethCallOnly: { type: "boolean" },
      executable: { type: "boolean" }, revertsWith: { type: "string" },
      transactionCount: { const: 0 }, outputFields: { type: "array", items: { type: "string" } },
      target: ADDRESS, function: { const: "fillDirect" }, sourceTransactionCount: { const: 1 },
    },
  };
  const resolve = {
    type: "object", additionalProperties: false,
    required: [
      "signature", "selector", "stateMutability", "ethCallOnly", "transactionCount",
      "stepCount", "stepType", "target", "function", "sourceExecutionCallCount",
    ],
    properties: {
      signature: { const: "resolve(bytes)" }, selector: SELECTOR, stateMutability: { const: "view" },
      ethCallOnly: { const: true }, transactionCount: { const: 0 },
      stepCount: { const: 1 }, stepType: { const: "Call" }, target: ADDRESS,
      function: { const: "fillDirect" }, sourceExecutionCallCount: { const: 1 },
    },
  };
  const describeMandate = {
    type: "object", additionalProperties: false,
    required: [
      "supported", "signature", "selector", "stateMutability", "ethCallOnly",
      "transactionCount", "outputFields",
    ],
    properties: {
      supported: { const: true }, signature: { const: "describeMandate(bytes)" },
      selector: SELECTOR, stateMutability: { const: "pure" }, ethCallOnly: { const: true },
      transactionCount: { const: 0 }, outputFields: { type: "array", items: { type: "string" } },
    },
  };
  const module = {
    type: "object", additionalProperties: false,
    required: [
      "name", "standardId", "compatibilityLevel", "executable", "moduleAddress",
      "expectedRuntimeCodeHash", "supportedChainIds", "sameAddressAcrossChains", "router",
      "selectors", "selectorSignatures", "erc165", "payloadEncoding", "discoveryMethod",
      "resolutionTransport", "resolveExecution",
    ],
    properties: {
      name: { enum: ["ERC-7683", "OIF"] }, standardId: BYTES32,
      compatibilityLevel: { enum: ["EXECUTABLE_RESOLVER", "DISCOVERY_DESCRIPTION_ONLY"] },
      compatibilityLevelId: BYTES32, executable: { type: "boolean" }, moduleAddress: ADDRESS,
      expectedRuntimeCodeHash: BYTES32,
      supportedChainIds: { type: "array", items: { type: "integer" } },
      sameAddressAcrossChains: { const: true }, router: ADDRESS,
      selectors: { type: "object", additionalProperties: SELECTOR },
      selectorSignatures: { type: "object", additionalProperties: { type: "string" } },
      erc165: {
        type: "object", additionalProperties: false, required: ["supported", "interfaceIds"],
        properties: {
          supported: { const: true }, interfaceIds: { type: "array", items: SELECTOR },
        },
      },
      payloadEncoding: ref("StandardPayloadEncoding"), discoveryMethod: { type: "string" },
      resolutionTransport: {
        enum: ["OFFCHAIN_ETH_CALL", "OFFCHAIN_ETH_CALL_DESCRIPTION_ONLY"],
      },
      resolve, describeMandate, resolveExecution: resolution,
    },
  };
  return {
    StandardPayloadEncoding: payloadEncoding,
    StandardsManifest: {
      type: "object", additionalProperties: false,
      required: [
        "schema", "protocol", "status", "deploymentVersion", "releaseId",
        "supportedChainIds", "sameAddressAcrossChains", "router", "payloadEncoding",
        "standards", "executionInvariant",
      ],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_STANDARDS_MANIFEST_V1" },
        protocol: { const: "Nexa V6" }, status: { const: "ACTIVE" },
        deploymentVersion: { const: 6 }, releaseId: BYTES32,
        supportedChainIds: { type: "array", items: { type: "integer" } },
        sameAddressAcrossChains: { const: true },
        router: {
          type: "object", additionalProperties: false,
          required: [
            "address", "expectedRuntimeCodeHash", "sourceExecutionFunction",
            "sourceTransactionCount",
          ],
          properties: {
            address: ADDRESS, expectedRuntimeCodeHash: BYTES32,
            sourceExecutionFunction: { const: "fillDirect" }, sourceTransactionCount: { const: 1 },
          },
        },
        payloadEncoding: ref("StandardPayloadEncoding"),
        standards: {
          type: "object", additionalProperties: false, required: ["erc7683", "oif"],
          properties: { erc7683: module, oif: module },
        },
        executionInvariant: {
          type: "object", additionalProperties: false,
          required: ["botSourceTransactions", "nexaDestinationTransactions", "totalTransactions"],
          properties: {
            botSourceTransactions: { const: 1 },
            nexaDestinationTransactions: { const: 1 },
            totalTransactions: { const: 2 },
          },
        },
      },
    },
  };
}

function discoverySchemas() {
  const selectors = { type: "object", additionalProperties: SELECTOR };
  const signatures = { type: "object", additionalProperties: { type: "string" } };
  const erc165 = {
    type: "object", additionalProperties: true,
    required: ["supported", "erc165InterfaceId", "nexaStandardModuleV6InterfaceId"],
    properties: {
      supported: { const: true }, erc165InterfaceId: SELECTOR,
      nexaStandardModuleV6InterfaceId: SELECTOR, resolverDetection: { type: "string" },
    },
  };
  const standardFingerprint = {
    type: "object", additionalProperties: false,
    required: [
      "sameAddressAcrossChains", "chains", "runtimeCodeHash", "router", "standardId",
      "selectors", "selectorSignatures", "erc165",
    ],
    properties: {
      resolver: ADDRESS, module: ADDRESS, sameAddressAcrossChains: { const: true },
      chains: { type: "array", items: { type: "integer" } }, runtimeCodeHash: BYTES32,
      router: ADDRESS, standardId: BYTES32, compatibilityLevel: BYTES32,
      compatibilityLevelName: { type: "string" }, executable: { type: "boolean" },
      selectors, selectorSignatures: signatures, erc165,
      discoveryMapping: {
        type: "object", additionalProperties: false,
        properties: {
          resolver: ADDRESS, router: ADDRESS, facade: ADDRESS,
          discoveryURI: { type: "string", format: "uri" },
        },
      },
    },
  };
  const sourceFill = {
    type: "object", additionalProperties: false,
    required: [
      "contract", "address", "sameAddressAcrossChains", "chains", "signature", "topic0",
      "indexed", "fields", "indexedFields", "indexedTopicPositions", "nonIndexed",
      "discoveryMapping",
    ],
    properties: {
      contract: { type: "string" }, address: ADDRESS, sameAddressAcrossChains: { const: true },
      chains: { type: "array", items: { type: "integer" } }, signature: { type: "string" },
      topic0: BYTES32, indexed: { type: "array", items: { type: "string" } },
      fields: { type: "array", items: { type: "string" } },
      indexedFields: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["name", "type", "topicPosition"],
          properties: {
            name: { type: "string" }, type: { type: "string" },
            topicPosition: { type: "integer", minimum: 1, maximum: 3 },
          },
        },
      },
      indexedTopicPositions: {
        type: "object", additionalProperties: { type: "integer", minimum: 1, maximum: 3 },
      },
      nonIndexed: { type: "array", items: { type: "string" } },
      discoveryMapping: {
        type: "object", additionalProperties: false,
        required: ["router", "facade", "discoveryURI"],
        properties: { router: ADDRESS, facade: ADDRESS, discoveryURI: { type: "string", format: "uri" } },
      },
    },
  };
  return {
    OnchainDiscoveryFingerprint: {
      type: "object", additionalProperties: false,
      required: [
        "schema", "protocol", "status", "deploymentVersion", "releaseId", "discoveryURI",
        "onchainDiscoveryURI", "feedURI", "publicIntegrationRepo", "chains",
        "sameAddressAcrossChains", "facade", "facadeRuntimeCodeHash", "registry",
        "registryRuntimeCodeHash", "router", "routerRuntimeCodeHash", "selectors",
        "selectorSignatures", "events", "erc7683", "oif", "deployment", "chainEvidence",
        "sourcify", "discoveryPaths", "scannerHints",
      ],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_ONCHAIN_DISCOVERY_FINGERPRINT_V1" },
        protocol: { const: "Nexa V6" }, status: { const: "ACTIVE" },
        deploymentVersion: { const: 6 }, releaseId: BYTES32,
        discoveryURI: { type: "string", format: "uri" },
        onchainDiscoveryURI: { type: "string", format: "uri" },
        feedURI: { type: "string", format: "uri" },
        publicIntegrationRepo: { type: "string", format: "uri" },
        chains: { type: "array", items: { type: "integer" } },
        sameAddressAcrossChains: { const: true }, facade: ADDRESS,
        facadeRuntimeCodeHash: BYTES32, registry: ADDRESS, registryRuntimeCodeHash: BYTES32,
        router: ADDRESS, routerRuntimeCodeHash: BYTES32, selectors,
        selectorSignatures: signatures,
        events: {
          type: "object", additionalProperties: false, required: ["SourceFillV6"],
          properties: { SourceFillV6: sourceFill },
        },
        erc7683: standardFingerprint, oif: standardFingerprint,
        deployment: {
          type: "object", additionalProperties: false,
          required: [
            "method", "factory", "salt", "initCodeHash", "expectedFacadeAddress",
            "supportedChainIds", "sameAddressAcrossChains", "compiler",
            "standardJsonInputHash", "blocks", "transactions",
          ],
          properties: {
            method: { const: "CREATE2" }, factory: ADDRESS, salt: BYTES32,
            initCodeHash: BYTES32, expectedFacadeAddress: ADDRESS,
            supportedChainIds: { type: "array", items: { type: "integer" } },
            sameAddressAcrossChains: { const: true }, compiler: { type: "string" },
            standardJsonInputHash: BYTES32,
            blocks: { type: "object", additionalProperties: { type: "integer" } },
            transactions: { type: "object", additionalProperties: BYTES32 },
          },
        },
        chainEvidence: {
          type: "object",
          additionalProperties: {
            type: "object", additionalProperties: false,
            required: [
              "network", "deploymentTransactionHash", "deploymentBlockNumber",
              "explorer", "sourcify", "sourcifyMatchId",
            ],
            properties: {
              network: { type: "string" }, deploymentTransactionHash: BYTES32,
              deploymentBlockNumber: { type: "integer" },
              explorer: { type: "string", format: "uri" },
              sourcify: { type: "string", format: "uri" }, sourcifyMatchId: { type: "string" },
            },
          },
        },
        sourcify: {
          type: "object", additionalProperties: true,
          required: [
            "exactMatchOnEveryChain", "allChainsLookup", "contractLookupTemplate",
            "verifiedContractsListTemplate", "signatureLookup", "sourceFillV6Signature",
          ],
          properties: {
            exactMatchOnEveryChain: { const: true },
            allChainsLookup: { type: "string", format: "uri" },
            contractLookupTemplate: { type: "string" },
            verifiedContractsListTemplate: { type: "string" },
            signatureLookup: { type: "string", format: "uri" },
            sourceFillV6Signature: { type: "object", additionalProperties: true },
          },
        },
        discoveryPaths: { type: "array", items: { type: "string" } },
        scannerHints: ref("ScannerHints"),
      },
    },
    SolverDiscovery: {
      type: "object", additionalProperties: false,
      required: [
        "schema", "deploymentVersion", "deploymentStatus", "releaseId", "feedSigner",
        "solverProfile", "discoveryModel", "executionModel", "publication", "feedTransport",
        "authentication", "permitRequestSigning", "endpoints", "standards",
        "passiveOnchainDiscovery", "activationRequired",
      ],
      properties: {
        schema: { const: "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2" },
        deploymentVersion: { const: 6 }, deploymentStatus: { const: "ACTIVE" },
        releaseId: BYTES32, feedSigner: ADDRESS,
        solverProfile: {
          type: "object", additionalProperties: false,
          required: [
            "executionScopes", "automatedDiscovery", "variableSizeExecution",
            "machineVerifiableState", "accountlessDiscovery",
          ],
          properties: {
            executionScopes: {
              type: "array", items: { enum: ["INTRA_CHAIN", "CROSS_CHAIN"] },
            },
            automatedDiscovery: { const: true }, variableSizeExecution: { const: true },
            machineVerifiableState: { const: true }, accountlessDiscovery: { const: true },
          },
        },
        discoveryModel: { const: "SIGNED_MACHINE_READABLE_FEED" },
        executionModel: { const: "EXACTLY_ONE_BOT_SOURCE_TX_PLUS_ONE_NEXA_DESTINATION_TX" },
        publication: { const: "SIGNED_OFFCHAIN_FEED_ZERO_PERIODIC_GAS" },
        feedTransport: {
          type: "object", additionalProperties: false,
          required: ["primary", "recovery", "reconnectWithLastEventId"],
          properties: {
            primary: { const: "SSE_CONFIRMED_ACTIVE_SET" },
            recovery: { const: "HTTP_SIGNED_FEED" },
            reconnectWithLastEventId: { const: true },
          },
        },
        authentication: { const: "WALLET_OR_NATIVE_ACCOUNT_PROOF" },
        permitRequestSigning: {
          type: "object", additionalProperties: false,
          required: [
            "mode", "domain", "canonicalizer", "messageBuilder", "signatureScheme",
            "canonicalJson", "messageLines", "requestMessageEndpointRequired",
          ],
          properties: {
            mode: { const: "LOCAL_DETERMINISTIC_MESSAGE" }, domain: { type: "string" },
            canonicalizer: { const: "canonicalPermitRequest" },
            messageBuilder: { const: "permitRequestMessage" },
            signatureScheme: { const: "EIP191_PERSONAL_SIGN_UTF8" },
            canonicalJson: { const: "RECURSIVE_SORTED_OBJECT_KEYS_COMPACT_JSON" },
            messageLines: { type: "array", items: { type: "string" } },
            requestMessageEndpointRequired: { const: false },
          },
        },
        endpoints: {
          type: "object", additionalProperties: false, required: Object.keys(V6_HTTP_PATHS),
          properties: Object.fromEntries(
            Object.keys(V6_HTTP_PATHS).map((key) => [key, { type: "string", format: "uri" }]),
          ),
        },
        standards: {
          type: "array", minItems: 2, maxItems: 2,
          items: {
            type: "object", additionalProperties: false,
            required: ["standardId", "name", "compatibilityLevel", "moduleAddress", "executable"],
            properties: {
              standardId: BYTES32, name: { enum: ["ERC-7683", "OIF"] },
              compatibilityLevel: { type: "string" }, moduleAddress: ADDRESS,
              executable: { type: "boolean" },
            },
          },
        },
        passiveOnchainDiscovery: {
          type: "object", additionalProperties: false,
          required: ["uri", "facadeAddress", "chains", "sameAddressAcrossChains"],
          properties: {
            uri: { type: "string", format: "uri" }, facadeAddress: ADDRESS,
            chains: { type: "array", items: { type: "integer" } },
            sameAddressAcrossChains: { const: true },
          },
        },
        activationRequired: { const: false },
      },
    },
  };
}

function routeDetailSchemas() {
  return {
    RouteMetrics: {
      type: "object", additionalProperties: false,
      required: ["telemetryAvailable", "permitConversionRate", "fillConversionRate"],
      properties: {
        telemetryAvailable: { type: "boolean" },
        source: { const: "V6_PUBLICATION_LEARNING_STATE" },
        feed_exposures: { type: "integer", minimum: 0 },
        permit_requests: { type: "integer", minimum: 0 },
        permits_issued: { type: "integer", minimum: 0 },
        source_observed: { type: "integer", minimum: 0 },
        paid: { type: "integer", minimum: 0 },
        updatedAt: nullable({ type: "string", format: "date-time" }),
        permitConversionRate: nullable({ type: "number", minimum: 0 }),
        fillConversionRate: nullable({ type: "number", minimum: 0 }),
      },
    },
    RouteDetailResponse: {
      type: "object", additionalProperties: false, required: ["ok", "route", "metrics"],
      properties: { ok: { const: true }, route: ref("Route"), metrics: ref("RouteMetrics") },
    },
  };
}

function v6OpenApiSchemas() {
  return {
    ErrorResponse: {
      type: "object", additionalProperties: false, required: ["ok", "error"],
      properties: {
        ok: { const: false }, error: { type: "string" },
        reasonCodes: { type: "array", items: { type: "string" } },
        diagnostics: nullable({ type: "object", additionalProperties: true }),
      },
    },
    SseErrorEvent: {
      type: "object", additionalProperties: false, required: ["error"],
      properties: { error: { type: "string" } },
    },
    Route: routeSchema(),
    ...feedSchemas(),
    ...routeDetailSchemas(),
    ...permitSchemas(),
    ...scannerSchemas(),
    ...standardsSchemas(),
    ...discoverySchemas(),
  };
}

function v6OpenApiDocument(options = {}) {
  const baseUrl = String(options.publicBaseUrl ?? "https://solver.vsnexa.com").replace(/\/+$/, "");
  const schemas = v6OpenApiSchemas();
  const routeIdParameter = {
    name: "routeId", in: "path", required: true,
    schema: schemas.Route.properties.routeId,
    description: "Canonical routeId from the active signed feed.",
  };
  const fillIdParameter = {
    name: "fillId", in: "path", required: true,
    schema: schemas.ExecutionPermitEnvelope.properties.fillId,
  };
  const permitMessageBody = {
    required: true,
    content: { "application/json": { schema: ref("PermitRequest") } },
  };
  const signedPermitBody = {
    required: true,
    content: {
      "application/json": {
        schema: {
          allOf: [
            ref("PermitRequest"),
            { type: "object", required: ["requestSignature"] },
          ],
        },
      },
    },
  };
  return deepFreeze({
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "Nexa V6 Solver Integration API",
      version: "6.3.0",
      description: "Machine-readable Nexa V6 discovery, signed active-set feed, route detail, and execution-permit surface. Static discovery endpoints perform no database, RPC, timer, or transaction work.",
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: "Discovery" }, { name: "Feed" }, { name: "Routes" }, { name: "Permits" },
    ],
    paths: {
      [V6_HTTP_PATHS.manifest]: {
        get: {
          tags: ["Discovery"], operationId: "getSolverManifest",
          responses: {
            200: jsonResponse(ref("SolverDiscovery"), "Canonical Solver discovery manifest."),
          },
        },
      },
      [V6_HTTP_PATHS.onchainDiscovery]: {
        get: {
          tags: ["Discovery"], operationId: "getOnchainDiscovery",
          responses: {
            200: jsonResponse(
              ref("OnchainDiscoveryFingerprint"),
              "Passive onchain fingerprint and scanner hints.",
            ),
          },
        },
      },
      [V6_HTTP_PATHS.openapi]: {
        get: {
          tags: ["Discovery"], operationId: "getOpenApi",
          responses: {
            200: jsonResponse(
              { type: "object", required: ["openapi", "info", "paths", "components"] },
              "This OpenAPI 3.1 document.",
            ),
          },
        },
      },
      [V6_HTTP_PATHS.standards]: {
        get: {
          tags: ["Discovery"], operationId: "getStandardsManifest",
          responses: {
            200: jsonResponse(
              ref("StandardsManifest"),
              "ERC-7683 and OIF machine integration metadata.",
            ),
          },
        },
      },
      [V6_HTTP_PATHS.solverDiscovery]: {
        get: {
          tags: ["Discovery"], operationId: "getSolverDiscovery",
          responses: {
            200: jsonResponse(ref("SolverDiscovery"), "Canonical Solver discovery manifest."),
            ...errorResponses([503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.solverFeed]: {
        get: {
          tags: ["Feed"], operationId: "getSolverFeed",
          parameters: [
            {
              name: "sourceChainId", in: "query", required: false,
              schema: { type: "string", pattern: "^[1-9][0-9]*$" },
            },
            {
              name: "sourceNetworkId", in: "query", required: false,
              schema: schemas.Route.properties.sourceNetworkId,
            },
          ],
          responses: {
            200: jsonResponse(
              ref("FeedResponse"),
              "Signed active-set feed. Verify signedPayload, never a filtered route view.",
            ),
            ...errorResponses([400, 503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.solverFeedEvents]: {
        get: {
          tags: ["Feed"], operationId: "streamSolverFeed",
          description: "LISTEN/NOTIFY-backed current-state stream with no replay and no polling. No Last-Event-ID sends current immediately; an older ID sends current immediately; an ID equal to current suppresses the initial event; an invalid ID is ignored and current is sent. Subsequent confirmed publications are always emitted.",
          parameters: [{
            name: "Last-Event-ID", in: "header", required: false,
            schema: { type: "string", pattern: "^(?:0|[1-9][0-9]*)$" },
            description: "Feed dataVersion used only to suppress an identical initial current-state event. No history is replayed.",
          }],
          responses: {
            200: {
              description: "SSE events: feed (id=dataVersion, data=SignedFeed), publication-closed, or error.",
              content: { "text/event-stream": { schema: { type: "string" } } },
              "x-nexa-events": {
                feed: { schema: ref("SignedFeed"), id: "dataVersion" },
                "publication-closed": { schema: ref("SseErrorEvent") },
                error: { schema: ref("SseErrorEvent") },
              },
            },
            ...errorResponses([503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.routeDetailTemplate]: {
        get: {
          tags: ["Routes"], operationId: "getRouteDetail",
          parameters: [routeIdParameter],
          responses: {
            200: jsonResponse(
              ref("RouteDetailResponse"),
              "Exact canonical active signed-feed route plus separate observational metrics.",
            ),
            ...errorResponses([404, 503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.permitRequestMessage]: {
        post: {
          tags: ["Permits"], operationId: "buildPermitRequestMessage",
          requestBody: permitMessageBody,
          responses: {
            200: jsonResponse(
              ref("PermitRequestMessageResponse"),
              "Exact deterministic UTF-8 message for local signing.",
            ),
            ...errorResponses([400, 409, 410, 413, 503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.executionPermits]: {
        post: {
          tags: ["Permits"], operationId: "createExecutionPermit",
          parameters: [{
            name: "Idempotency-Key", in: "header", required: false,
            schema: schemas.PermitRequest.properties.idempotencyKey,
            description: "Must equal body idempotencyKey when both are supplied.",
          }],
          requestBody: signedPermitBody,
          responses: {
            201: jsonResponse(ref("ExecutionPermitResponse"), "New execution permit issued."),
            200: jsonResponse(
              ref("ExecutionPermitResponse"),
              "Existing permit returned for an identical idempotent request.",
            ),
            ...errorResponses([400, 409, 410, 413, 429, 503, 500]),
          },
        },
      },
      [V6_HTTP_PATHS.permitStatusTemplate]: {
        get: {
          tags: ["Permits"], operationId: "getExecutionPermit",
          parameters: [fillIdParameter],
          responses: {
            200: jsonResponse(ref("PermitStatusResponse"), "Current persisted permit status."),
            ...errorResponses([404, 500]),
          },
        },
      },
    },
    components: { schemas },
  });
}

module.exports = {
  v6OpenApiDocument,
  v6OpenApiSchemas,
};
