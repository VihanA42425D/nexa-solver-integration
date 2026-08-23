import { Interface, id } from "ethers";

export const INDEXED_EVENT_DEFINITIONS = Object.freeze({
  NetworkRegisteredV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event NetworkRegisteredV6(bytes32 indexed networkId,bytes32 indexed vmType,bytes32 networkReference,bytes32 metadataHash)",
  }),
  NetworkStatusChangedV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event NetworkStatusChangedV6(bytes32 indexed networkId,uint8 previousStatus,uint8 status,uint64 generation)",
  }),
  AssetRegisteredV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event AssetRegisteredV6(bytes32 indexed assetKey,bytes32 indexed networkId,bytes32 indexed assetId,address localAddress,bool hasLocalBinding,bytes32 metadataHash)",
  }),
  AssetStatusChangedV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event AssetStatusChangedV6(bytes32 indexed assetKey,uint8 previousStatus,uint8 status,uint64 generation)",
  }),
  RouteRegisteredV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event RouteRegisteredV6(bytes32 indexed routeId,bytes32 indexed sourceNetworkId,bytes32 indexed destinationNetworkId,bytes32 sourceAssetId,bytes32 destinationAssetId)",
  }),
  RouteStatusChangedV6: Object.freeze({
    contract: "NexaMainnetRegistryV6",
    abi: "event RouteStatusChangedV6(bytes32 indexed routeId,uint8 previousStatus,uint8 status,address indexed actor,uint64 generation)",
  }),
  SourceIntakeConfigured: Object.freeze({
    contract: "NexaMainnetRouterV6",
    abi: "event SourceIntakeConfigured(bool enabled,address indexed actor)",
  }),
  SourceFillV6: Object.freeze({
    contract: "NexaMainnetRouterV6",
    abi: "event SourceFillV6(bytes32 indexed fillId,bytes32 indexed routeId,bytes32 indexed quoteId,address payer,address recipient,address sourceAsset,address destinationAsset,uint256 destinationChainId,uint128 amountInRaw,uint128 amountOutRaw,uint32 sourceFinalityBlocks,uint64 settlementDeadline,bytes32 permitNonce,bytes32 executionGeneration)",
  }),
  StandardModuleConfiguredV6: Object.freeze({
    contract: "NexaStandardModuleRegistryV6",
    abi: "event StandardModuleConfiguredV6(bytes32 indexed standardId,address indexed previousModule,address indexed module)",
  }),
});

export function eventDescriptor(name, definition) {
  const fragment = new Interface([definition.abi]).getEvent(name);
  const signature = fragment.format("sighash");
  return {
    contract: definition.contract,
    signature,
    topic0: id(signature),
    abi: definition.abi,
    indexed: fragment.inputs.filter((input) => input.indexed).map((input) => input.name),
    fields: fragment.inputs.map((input) => ({
      name: input.name,
      type: input.type,
      indexed: input.indexed === true,
    })),
  };
}

export function buildIndexedEventsBundle() {
  return {
    schema: "NEXA_MAINNET_V6_EVENTS_FINAL",
    deploymentVersion: 6,
    source: "AUDITED_DEPLOYED_V6_SOLIDITY_EVENTS",
    events: Object.fromEntries(Object.entries(INDEXED_EVENT_DEFINITIONS)
      .map(([name, definition]) => [name, eventDescriptor(name, definition)])),
  };
}
