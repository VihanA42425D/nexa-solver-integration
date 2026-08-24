import {
  Address,
  BigInt,
  Bytes,
  DataSourceContext,
  JSONValue,
  TypedMap,
  ethereum,
  json,
} from "@graphprotocol/graph-ts";
import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  newTypedMockEventWithParams,
  readFile,
  test,
} from "matchstick-as/assembly/index";
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
  handleAssetRegisteredV6,
  handleAssetStatusChangedV6,
  handleNetworkRegisteredV6,
  handleNetworkStatusChangedV6,
  handleRouteRegisteredV6,
  handleRouteStatusChangedV6,
  handleSourceFillV6,
  handleSourceIntakeConfigured,
  handleStandardModuleConfiguredV6,
} from "../src/mapping";

const FIXTURE_ROOT = json.fromBytes(readFile("../fixtures/nexa-v6-events.json")).toObject();
const FIXTURES = FIXTURE_ROOT.mustGet("fixtures").toArray();
const CONFIG = json.fromBytes(readFile("../nexa-v6-indexing.json")).toObject();
const BASE_NETWORK = CONFIG.mustGet("networks").toArray()[0].toObject();
const CHAIN_ID = BASE_NETWORK.mustGet("chainId").toI64().toString();

function expected(item: TypedMap<string, JSONValue>): TypedMap<string, JSONValue> {
  return item.mustGet("expectedNormalized").toObject();
}

function provenance(item: TypedMap<string, JSONValue>): TypedMap<string, JSONValue> {
  return item.mustGet("provenance").toObject();
}

function stringField(object: TypedMap<string, JSONValue>, key: string): string {
  return object.mustGet(key).toString();
}

function bytesField(object: TypedMap<string, JSONValue>, key: string): Bytes {
  return Bytes.fromHexString(stringField(object, key));
}

function addressField(object: TypedMap<string, JSONValue>, key: string): Address {
  return Address.fromString(stringField(object, key));
}

function bigIntField(object: TypedMap<string, JSONValue>, key: string): BigInt {
  return BigInt.fromString(stringField(object, key));
}

function i32Field(object: TypedMap<string, JSONValue>, key: string): i32 {
  return I32.parseInt(stringField(object, key));
}

function chainAwareId(value: string): string {
  return CHAIN_ID + ":" + value.toLowerCase();
}

function changeId(item: TypedMap<string, JSONValue>): string {
  const source = provenance(item);
  return CHAIN_ID + ":" + stringField(source, "transactionHash").toLowerCase()
    + ":" + source.mustGet("logIndex").toI64().toString();
}

function eventParam(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function applyProvenance(event: ethereum.Event, item: TypedMap<string, JSONValue>): void {
  const source = provenance(item);
  event.address = Address.fromString(stringField(item, "address"));
  event.block.number = BigInt.fromString(stringField(source, "blockNumber"));
  event.block.timestamp = BigInt.fromString(stringField(source, "blockTimestamp"));
  event.transaction.hash = Bytes.fromHexString(stringField(source, "transactionHash"));
  event.logIndex = BigInt.fromString(source.mustGet("logIndex").toI64().toString());
  event.transactionLogIndex = event.logIndex;
}

function contractKey(eventName: string): string {
  if (eventName == "SourceIntakeConfigured" || eventName == "SourceFillV6") return "router";
  if (eventName == "StandardModuleConfiguredV6") return "standardModuleRegistry";
  return "registry";
}

function configureDataSource(item: TypedMap<string, JSONValue>): void {
  const contracts = BASE_NETWORK.mustGet("contracts").toObject();
  const contract = contracts.mustGet(contractKey(stringField(item, "eventName"))).toObject();
  const standards = CONFIG.mustGet("standards").toObject();
  const context = new DataSourceContext();
  context.setBigInt("chainId", BigInt.fromString(CHAIN_ID));
  context.setBytes("releaseId", Bytes.fromHexString(stringField(BASE_NETWORK, "releaseId")));
  context.setString("contractName", stringField(contract, "contract"));
  context.setBigInt("startBlock", BigInt.fromString(contract.mustGet("startBlock").toI64().toString()));
  context.setBytes("runtimeCodeHash", Bytes.fromHexString(stringField(contract, "runtimeCodeHash")));
  context.setBytes("erc7683StandardId", bytesField(standards.mustGet("erc7683").toObject(), "standardId"));
  context.setBytes("oifStandardId", bytesField(standards.mustGet("oif").toObject(), "standardId"));
  dataSourceMock.setContext(context);
}

function execute(item: TypedMap<string, JSONValue>): void {
  const name = stringField(item, "eventName");
  const value = expected(item);
  configureDataSource(item);

  if (name == "NetworkRegisteredV6") {
    const event = newTypedMockEventWithParams<NetworkRegisteredV6>([
      eventParam("networkId", ethereum.Value.fromFixedBytes(bytesField(value, "networkId"))),
      eventParam("vmType", ethereum.Value.fromFixedBytes(bytesField(value, "vmType"))),
      eventParam("networkReference", ethereum.Value.fromFixedBytes(bytesField(value, "networkReference"))),
      eventParam("metadataHash", ethereum.Value.fromFixedBytes(bytesField(value, "metadataHash"))),
    ]);
    applyProvenance(event, item);
    handleNetworkRegisteredV6(event);
    return;
  }
  if (name == "NetworkStatusChangedV6") {
    const event = newTypedMockEventWithParams<NetworkStatusChangedV6>([
      eventParam("networkId", ethereum.Value.fromFixedBytes(bytesField(value, "networkId"))),
      eventParam("previousStatus", ethereum.Value.fromI32(i32Field(value, "previousStatus"))),
      eventParam("status", ethereum.Value.fromI32(i32Field(value, "status"))),
      eventParam("generation", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "generation"))),
    ]);
    applyProvenance(event, item);
    handleNetworkStatusChangedV6(event);
    return;
  }
  if (name == "AssetRegisteredV6") {
    const event = newTypedMockEventWithParams<AssetRegisteredV6>([
      eventParam("assetKey", ethereum.Value.fromFixedBytes(bytesField(value, "assetKey"))),
      eventParam("networkId", ethereum.Value.fromFixedBytes(bytesField(value, "networkId"))),
      eventParam("assetId", ethereum.Value.fromFixedBytes(bytesField(value, "assetId"))),
      eventParam("localAddress", ethereum.Value.fromAddress(addressField(value, "localAddress"))),
      eventParam("hasLocalBinding", ethereum.Value.fromBoolean(value.mustGet("hasLocalBinding").toBool())),
      eventParam("metadataHash", ethereum.Value.fromFixedBytes(bytesField(value, "metadataHash"))),
    ]);
    applyProvenance(event, item);
    handleAssetRegisteredV6(event);
    return;
  }
  if (name == "AssetStatusChangedV6") {
    const event = newTypedMockEventWithParams<AssetStatusChangedV6>([
      eventParam("assetKey", ethereum.Value.fromFixedBytes(bytesField(value, "assetKey"))),
      eventParam("previousStatus", ethereum.Value.fromI32(i32Field(value, "previousStatus"))),
      eventParam("status", ethereum.Value.fromI32(i32Field(value, "status"))),
      eventParam("generation", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "generation"))),
    ]);
    applyProvenance(event, item);
    handleAssetStatusChangedV6(event);
    return;
  }
  if (name == "RouteRegisteredV6") {
    const event = newTypedMockEventWithParams<RouteRegisteredV6>([
      eventParam("routeId", ethereum.Value.fromFixedBytes(bytesField(value, "routeId"))),
      eventParam("sourceNetworkId", ethereum.Value.fromFixedBytes(bytesField(value, "sourceNetworkId"))),
      eventParam("destinationNetworkId", ethereum.Value.fromFixedBytes(bytesField(value, "destinationNetworkId"))),
      eventParam("sourceAssetId", ethereum.Value.fromFixedBytes(bytesField(value, "sourceAssetId"))),
      eventParam("destinationAssetId", ethereum.Value.fromFixedBytes(bytesField(value, "destinationAssetId"))),
    ]);
    applyProvenance(event, item);
    handleRouteRegisteredV6(event);
    return;
  }
  if (name == "RouteStatusChangedV6") {
    const event = newTypedMockEventWithParams<RouteStatusChangedV6>([
      eventParam("routeId", ethereum.Value.fromFixedBytes(bytesField(value, "routeId"))),
      eventParam("previousStatus", ethereum.Value.fromI32(i32Field(value, "previousStatus"))),
      eventParam("status", ethereum.Value.fromI32(i32Field(value, "status"))),
      eventParam("actor", ethereum.Value.fromAddress(addressField(value, "actor"))),
      eventParam("generation", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "generation"))),
    ]);
    applyProvenance(event, item);
    handleRouteStatusChangedV6(event);
    return;
  }
  if (name == "SourceIntakeConfigured") {
    const event = newTypedMockEventWithParams<SourceIntakeConfigured>([
      eventParam("enabled", ethereum.Value.fromBoolean(value.mustGet("enabled").toBool())),
      eventParam("actor", ethereum.Value.fromAddress(addressField(value, "actor"))),
    ]);
    applyProvenance(event, item);
    handleSourceIntakeConfigured(event);
    return;
  }
  if (name == "SourceFillV6") {
    const event = newTypedMockEventWithParams<SourceFillV6>([
      eventParam("fillId", ethereum.Value.fromFixedBytes(bytesField(value, "fillId"))),
      eventParam("routeId", ethereum.Value.fromFixedBytes(bytesField(value, "routeId"))),
      eventParam("quoteId", ethereum.Value.fromFixedBytes(bytesField(value, "quoteId"))),
      eventParam("payer", ethereum.Value.fromAddress(addressField(value, "payer"))),
      eventParam("recipient", ethereum.Value.fromAddress(addressField(value, "recipient"))),
      eventParam("sourceAsset", ethereum.Value.fromAddress(addressField(value, "sourceAsset"))),
      eventParam("destinationAsset", ethereum.Value.fromAddress(addressField(value, "destinationAsset"))),
      eventParam("destinationChainId", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "destinationChainId"))),
      eventParam("amountInRaw", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "amountInRaw"))),
      eventParam("amountOutRaw", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "amountOutRaw"))),
      eventParam("sourceFinalityBlocks", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "sourceFinalityBlocks"))),
      eventParam("settlementDeadline", ethereum.Value.fromUnsignedBigInt(bigIntField(value, "settlementDeadline"))),
      eventParam("permitNonce", ethereum.Value.fromFixedBytes(bytesField(value, "permitNonce"))),
      eventParam("executionGeneration", ethereum.Value.fromFixedBytes(bytesField(value, "executionGeneration"))),
    ]);
    applyProvenance(event, item);
    handleSourceFillV6(event);
    return;
  }
  if (name == "StandardModuleConfiguredV6") {
    const event = newTypedMockEventWithParams<StandardModuleConfiguredV6>([
      eventParam("standardId", ethereum.Value.fromFixedBytes(bytesField(value, "standardId"))),
      eventParam("previousModule", ethereum.Value.fromAddress(addressField(value, "previousModule"))),
      eventParam("module", ethereum.Value.fromAddress(addressField(value, "module"))),
    ]);
    applyProvenance(event, item);
    handleStandardModuleConfiguredV6(event);
    return;
  }
  throw new Error("Unhandled canonical event: " + name);
}

function assertFields(
  entityType: string,
  id: string,
  value: TypedMap<string, JSONValue>,
  fields: Array<string>,
): void {
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    assert.fieldEquals(entityType, id, field, stringField(value, field));
  }
}

function assertProvenance(
  entityType: string,
  id: string,
  item: TypedMap<string, JSONValue>,
): void {
  const source = provenance(item);
  assert.fieldEquals(entityType, id, "chainId", stringField(source, "chainId"));
  assert.fieldEquals(entityType, id, "blockNumber", stringField(source, "blockNumber"));
  assert.fieldEquals(entityType, id, "blockTimestamp", stringField(source, "blockTimestamp"));
  assert.fieldEquals(entityType, id, "transactionHash", stringField(source, "transactionHash"));
  assert.fieldEquals(entityType, id, "logIndex", source.mustGet("logIndex").toI64().toString());
}

function verify(item: TypedMap<string, JSONValue>): void {
  const name = stringField(item, "eventName");
  const value = expected(item);
  let entityType = "";
  let id = "";
  let fields = new Array<string>();

  if (name == "NetworkRegisteredV6") {
    entityType = "Network";
    id = chainAwareId(stringField(value, "networkId"));
    fields = ["networkId", "vmType", "networkReference", "metadataHash"];
    assert.fieldEquals(entityType, id, "status", "1");
    assert.fieldEquals(entityType, id, "generation", "1");
  } else if (name == "NetworkStatusChangedV6") {
    entityType = "NetworkStatusChange";
    id = changeId(item);
    fields = ["networkId", "previousStatus", "status", "generation"];
    const stateId = chainAwareId(stringField(value, "networkId"));
    assert.fieldEquals("Network", stateId, "status", stringField(value, "status"));
    assert.fieldEquals("Network", stateId, "generation", stringField(value, "generation"));
    assertProvenance("Network", stateId, item);
  } else if (name == "AssetRegisteredV6") {
    entityType = "Asset";
    id = chainAwareId(stringField(value, "assetKey"));
    fields = ["assetKey", "networkId", "assetId", "localAddress", "metadataHash"];
    assert.fieldEquals(entityType, id, "hasLocalBinding", "true");
    assert.fieldEquals(entityType, id, "status", "1");
    assert.fieldEquals(entityType, id, "generation", "1");
  } else if (name == "AssetStatusChangedV6") {
    entityType = "AssetStatusChange";
    id = changeId(item);
    fields = ["assetKey", "previousStatus", "status", "generation"];
    const stateId = chainAwareId(stringField(value, "assetKey"));
    assert.fieldEquals("Asset", stateId, "status", stringField(value, "status"));
    assert.fieldEquals("Asset", stateId, "generation", stringField(value, "generation"));
    assertProvenance("Asset", stateId, item);
  } else if (name == "RouteRegisteredV6") {
    entityType = "Route";
    id = chainAwareId(stringField(value, "routeId"));
    fields = ["routeId", "sourceNetworkId", "sourceAssetId", "destinationNetworkId", "destinationAssetId"];
    assert.fieldEquals(entityType, id, "status", "1");
    assert.fieldEquals(entityType, id, "generation", "1");
  } else if (name == "RouteStatusChangedV6") {
    entityType = "RouteStatusChange";
    id = changeId(item);
    fields = ["routeId", "previousStatus", "status", "actor", "generation"];
    const stateId = chainAwareId(stringField(value, "routeId"));
    assert.fieldEquals("Route", stateId, "status", stringField(value, "status"));
    assert.fieldEquals("Route", stateId, "generation", stringField(value, "generation"));
    assertProvenance("Route", stateId, item);
  } else if (name == "SourceIntakeConfigured") {
    entityType = "SourceIntakeChange";
    id = changeId(item);
    fields = ["actor"];
    assert.fieldEquals(entityType, id, "router", stringField(item, "address"));
    assert.fieldEquals(entityType, id, "enabled", "true");
    const stateId = chainAwareId(stringField(item, "address"));
    assert.fieldEquals("RouterState", stateId, "router", stringField(item, "address"));
    assert.fieldEquals("RouterState", stateId, "sourceIntakeEnabled", "true");
    assert.fieldEquals("RouterState", stateId, "actor", stringField(value, "actor"));
    assertProvenance("RouterState", stateId, item);
  } else if (name == "SourceFillV6") {
    entityType = "SourceFill";
    id = chainAwareId(stringField(value, "fillId"));
    fields = [
      "fillId", "routeId", "quoteId", "payer", "recipient", "sourceAsset", "destinationAsset",
      "destinationChainId", "amountInRaw", "amountOutRaw", "sourceFinalityBlocks",
      "settlementDeadline", "permitNonce", "executionGeneration",
    ];
  } else if (name == "StandardModuleConfiguredV6") {
    entityType = "StandardModuleChange";
    id = changeId(item);
    fields = ["standardId", "previousModule", "module", "standardKind"];
    assert.fieldEquals(entityType, id, "enabled", "true");
    const stateId = chainAwareId(stringField(value, "standardId"));
    assert.fieldEquals("StandardModule", stateId, "standardId", stringField(value, "standardId"));
    assert.fieldEquals("StandardModule", stateId, "module", stringField(value, "module"));
    assert.fieldEquals("StandardModule", stateId, "enabled", "true");
    assert.fieldEquals("StandardModule", stateId, "standardKind", stringField(value, "standardKind"));
    assertProvenance("StandardModule", stateId, item);
  }

  assertFields(entityType, id, value, fields);
  assertProvenance(entityType, id, item);
}

describe("canonical Nexa V6 mapping fixtures", () => {
  test("execute the real shared handlers and persist canonical fields with provenance", () => {
    clearStore();
    for (let index = 0; index < FIXTURES.length; index++) {
      const item = FIXTURES[index].toObject();
      execute(item);
      verify(item);
    }
    assert.entityCount("ProtocolDeployment", 3);
    assert.entityCount("Network", 1);
    assert.entityCount("Asset", 1);
    assert.entityCount("Route", 1);
    assert.entityCount("RouteStatusChange", 2);
    assert.entityCount("RouterState", 1);
    assert.entityCount("SourceFill", 1);
    assert.entityCount("StandardModule", 2);
    assert.entityCount("StandardModuleChange", 2);
    dataSourceMock.resetValues();
    clearStore();
  });
});
