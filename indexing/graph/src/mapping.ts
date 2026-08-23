import {
  Address,
  BigInt,
  Bytes,
  Entity,
  Value,
  dataSource,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  AssetRegisteredV6,
  AssetStatusChangedV6,
  NetworkRegisteredV6,
  NetworkStatusChangedV6,
  RouteRegisteredV6,
  RouteStatusChangedV6,
} from "../generated/NexaMainnetRegistryV6/NexaMainnetRegistryV6";
import {
  SourceFillV6,
  SourceIntakeConfigured,
} from "../generated/NexaMainnetRouterV6/NexaMainnetRouterV6";
import { StandardModuleConfiguredV6 } from "../generated/NexaStandardModuleRegistryV6/NexaStandardModuleRegistryV6";
import {
  Asset,
  AssetStatusChange,
  Network,
  NetworkStatusChange,
  ProtocolDeployment,
  Route,
  RouteStatusChange,
  RouterState,
  SourceFill,
  SourceIntakeChange,
  StandardModule,
  StandardModuleChange,
} from "../generated/schema";

const REGISTERED = 1;

function configuredChainId(): BigInt {
  return dataSource.context().getBigInt("chainId");
}

function chainAwareId(value: Bytes): string {
  return configuredChainId().toString() + ":" + value.toHexString().toLowerCase();
}

function changeId(event: ethereum.Event): string {
  return configuredChainId().toString() + ":" + event.transaction.hash.toHexString().toLowerCase()
    + ":" + event.logIndex.toString();
}

function putProvenance(entity: Entity, event: ethereum.Event): void {
  entity.set("chainId", Value.fromBigInt(configuredChainId()));
  entity.set("blockNumber", Value.fromBigInt(event.block.number));
  entity.set("blockTimestamp", Value.fromBigInt(event.block.timestamp));
  entity.set("transactionHash", Value.fromBytes(event.transaction.hash));
  entity.set("logIndex", Value.fromBigInt(event.logIndex));
}

function touchDeployment(event: ethereum.Event): void {
  const id = chainAwareId(event.address);
  if (ProtocolDeployment.load(id) != null) return;
  const deployment = new ProtocolDeployment(id);
  deployment.releaseId = dataSource.context().getBytes("releaseId");
  deployment.contractName = dataSource.context().getString("contractName");
  deployment.contractAddress = event.address;
  deployment.startBlock = dataSource.context().getBigInt("startBlock");
  deployment.runtimeCodeHash = dataSource.context().getBytes("runtimeCodeHash");
  putProvenance(deployment, event);
  deployment.save();
}

export function handleNetworkRegisteredV6(event: NetworkRegisteredV6): void {
  touchDeployment(event);
  const entity = new Network(chainAwareId(event.params.networkId));
  entity.networkId = event.params.networkId;
  entity.vmType = event.params.vmType;
  entity.networkReference = event.params.networkReference;
  entity.metadataHash = event.params.metadataHash;
  entity.status = REGISTERED;
  entity.generation = BigInt.fromI32(1);
  putProvenance(entity, event);
  entity.save();
}

export function handleNetworkStatusChangedV6(event: NetworkStatusChangedV6): void {
  touchDeployment(event);
  const id = chainAwareId(event.params.networkId);
  const network = Network.load(id);
  if (network != null) {
    network.status = event.params.status;
    network.generation = event.params.generation;
    putProvenance(network, event);
    network.save();
  }
  const change = new NetworkStatusChange(changeId(event));
  change.networkId = event.params.networkId;
  change.previousStatus = event.params.previousStatus;
  change.status = event.params.status;
  change.generation = event.params.generation;
  putProvenance(change, event);
  change.save();
}

export function handleAssetRegisteredV6(event: AssetRegisteredV6): void {
  touchDeployment(event);
  const entity = new Asset(chainAwareId(event.params.assetKey));
  entity.assetKey = event.params.assetKey;
  entity.networkId = event.params.networkId;
  entity.assetId = event.params.assetId;
  entity.localAddress = event.params.localAddress;
  entity.hasLocalBinding = event.params.hasLocalBinding;
  entity.metadataHash = event.params.metadataHash;
  entity.status = REGISTERED;
  entity.generation = BigInt.fromI32(1);
  putProvenance(entity, event);
  entity.save();
}

export function handleAssetStatusChangedV6(event: AssetStatusChangedV6): void {
  touchDeployment(event);
  const id = chainAwareId(event.params.assetKey);
  const asset = Asset.load(id);
  if (asset != null) {
    asset.status = event.params.status;
    asset.generation = event.params.generation;
    putProvenance(asset, event);
    asset.save();
  }
  const change = new AssetStatusChange(changeId(event));
  change.assetKey = event.params.assetKey;
  change.previousStatus = event.params.previousStatus;
  change.status = event.params.status;
  change.generation = event.params.generation;
  putProvenance(change, event);
  change.save();
}

export function handleRouteRegisteredV6(event: RouteRegisteredV6): void {
  touchDeployment(event);
  const entity = new Route(chainAwareId(event.params.routeId));
  entity.routeId = event.params.routeId;
  entity.sourceNetworkId = event.params.sourceNetworkId;
  entity.sourceAssetId = event.params.sourceAssetId;
  entity.destinationNetworkId = event.params.destinationNetworkId;
  entity.destinationAssetId = event.params.destinationAssetId;
  entity.status = REGISTERED;
  entity.generation = BigInt.fromI32(1);
  putProvenance(entity, event);
  entity.save();
}

export function handleRouteStatusChangedV6(event: RouteStatusChangedV6): void {
  touchDeployment(event);
  const id = chainAwareId(event.params.routeId);
  const route = Route.load(id);
  if (route != null) {
    route.status = event.params.status;
    route.generation = event.params.generation;
    putProvenance(route, event);
    route.save();
  }
  const change = new RouteStatusChange(changeId(event));
  change.routeId = event.params.routeId;
  change.previousStatus = event.params.previousStatus;
  change.status = event.params.status;
  change.actor = event.params.actor;
  change.generation = event.params.generation;
  putProvenance(change, event);
  change.save();
}

export function handleSourceIntakeConfigured(event: SourceIntakeConfigured): void {
  touchDeployment(event);
  const state = new RouterState(chainAwareId(event.address));
  state.router = event.address;
  state.sourceIntakeEnabled = event.params.enabled;
  state.actor = event.params.actor;
  putProvenance(state, event);
  state.save();
  const change = new SourceIntakeChange(changeId(event));
  change.router = event.address;
  change.enabled = event.params.enabled;
  change.actor = event.params.actor;
  putProvenance(change, event);
  change.save();
}

export function handleSourceFillV6(event: SourceFillV6): void {
  touchDeployment(event);
  const entity = new SourceFill(chainAwareId(event.params.fillId));
  entity.fillId = event.params.fillId;
  entity.routeId = event.params.routeId;
  entity.quoteId = event.params.quoteId;
  entity.payer = event.params.payer;
  entity.recipient = event.params.recipient;
  entity.sourceAsset = event.params.sourceAsset;
  entity.destinationAsset = event.params.destinationAsset;
  entity.destinationChainId = event.params.destinationChainId;
  entity.amountInRaw = event.params.amountInRaw;
  entity.amountOutRaw = event.params.amountOutRaw;
  entity.sourceFinalityBlocks = event.params.sourceFinalityBlocks;
  entity.settlementDeadline = event.params.settlementDeadline;
  entity.permitNonce = event.params.permitNonce;
  entity.executionGeneration = event.params.executionGeneration;
  putProvenance(entity, event);
  entity.save();
}

function standardKind(standardId: Bytes): string {
  if (standardId.equals(dataSource.context().getBytes("erc7683StandardId"))) {
    return "ERC_7683_EXECUTABLE";
  }
  if (standardId.equals(dataSource.context().getBytes("oifStandardId"))) {
    return "OIF_DISCOVERY_DESCRIPTION_ONLY";
  }
  return "UNKNOWN";
}

export function handleStandardModuleConfiguredV6(event: StandardModuleConfiguredV6): void {
  touchDeployment(event);
  const enabled = !event.params.module.equals(Address.zero());
  const kind = standardKind(event.params.standardId);
  const entity = new StandardModule(chainAwareId(event.params.standardId));
  entity.standardId = event.params.standardId;
  entity.module = event.params.module;
  entity.enabled = enabled;
  entity.standardKind = kind;
  putProvenance(entity, event);
  entity.save();
  const change = new StandardModuleChange(changeId(event));
  change.standardId = event.params.standardId;
  change.previousModule = event.params.previousModule;
  change.module = event.params.module;
  change.enabled = enabled;
  change.standardKind = kind;
  putProvenance(change, event);
  change.save();
}
