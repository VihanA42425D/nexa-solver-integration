package com.vsnexa.v6;

import static com.vsnexa.v6.NexaV6Core.DEFAULT_RESOLVER;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.DynamicStruct;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.StaticStruct;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint128;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.utils.Numeric;

public final class NexaV6Abi {
  private NexaV6Abi() {}

  public record ExecutionTx(long chainId, String from, String to, String data, String value) {}
  public record ResolutionResult(String resolver, String routeId, String quoteId, String target,
      String value, String callData, String rawReturnData) {}
  public record PreviewResult(boolean valid, String reason, String rawReturnData) {}

  public static final class ExecutionPermit extends StaticStruct {
    public ExecutionPermit(JsonNode row) {
      super(
          b32(row, "releaseId"), b32(row, "fillId"), b32(row, "routeId"), b32(row, "quoteId"),
          b32(row, "policyHash"), b32(row, "permitNonce"), b32(row, "sourceNetworkId"),
          b32(row, "sourceAssetId"), b32(row, "destinationNetworkId"), b32(row, "destinationAssetId"),
          b32(row, "sourceVaultAccountId"), b32(row, "destinationVaultAccountId"),
          b32(row, "payerAccountId"), b32(row, "recipientAccountId"), u64(row, "dataVersion"),
          b32(row, "executionGeneration"), u64(row, "validAfter"), u64(row, "validUntil"),
          u32(row, "sourceFinalityBlocks"), u32(row, "settlementWindowSeconds"),
          u256(row, "sourceChainId"), u256(row, "destinationChainId"), addr(row, "sourceAsset"),
          addr(row, "destinationAsset"), addr(row, "sourceVault"), addr(row, "destinationVault"),
          addr(row, "sourceRouter"), addr(row, "payer"), addr(row, "recipient"),
          u128(row, "amountInRaw"), u128(row, "amountOutRaw"));
    }
  }

  public static final class ResolvedStruct extends DynamicStruct {
    public final Bytes32 routeId;
    public final Bytes32 quoteId;
    public final Address target;
    public final Uint256 value;
    public final DynamicBytes callData;

    public ResolvedStruct(Bytes32 routeId, Bytes32 quoteId, Address target, Uint256 value, DynamicBytes callData) {
      super(routeId, quoteId, target, value, callData);
      this.routeId = routeId;
      this.quoteId = quoteId;
      this.target = target;
      this.value = value;
      this.callData = callData;
    }
  }

  private static Bytes32 b32(JsonNode row, String key) {
    byte[] value = Numeric.hexStringToByteArray(row.path(key).asText());
    if (value.length != 32) throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
    return new Bytes32(value);
  }

  private static BigInteger integer(JsonNode row, String key) {
    try { return new BigInteger(row.path(key).asText()); }
    catch (Exception error) { throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error); }
  }

  private static Uint64 u64(JsonNode row, String key) { return new Uint64(integer(row, key)); }
  private static Uint32 u32(JsonNode row, String key) { return new Uint32(integer(row, key)); }
  private static Uint256 u256(JsonNode row, String key) { return new Uint256(integer(row, key)); }
  private static Uint128 u128(JsonNode row, String key) { return new Uint128(integer(row, key)); }
  private static Address addr(JsonNode row, String key) { return new Address(row.path(key).asText()); }

  private record PermitParts(JsonNode row, JsonNode permit, byte[] signature) {}

  private static PermitParts permitParts(JsonNode envelope) {
    JsonNode row = envelope;
    if (envelope.path("permit").path("permit").isObject()) row = envelope.path("permit");
    JsonNode permit = row.path("permit");
    byte[] signature = Numeric.hexStringToByteArray(row.path("permitSignature").asText());
    if (!permit.isObject() || signature.length != 65) throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
    return new PermitParts(row, permit, signature);
  }

  private static String permitCall(String method, JsonNode permit, byte[] signature) {
    try {
      return FunctionEncoder.encode(new Function(method,
          List.of(new ExecutionPermit(permit), new DynamicBytes(signature)), List.of()));
    } catch (Exception error) {
      throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error);
    }
  }

  public static ExecutionTx buildExecutionTx(JsonNode envelope) {
    PermitParts parts = permitParts(envelope);
    JsonNode permit = parts.permit();
    String target = parts.row().path("execution").path("target").asText(permit.path("sourceRouter").asText());
    String value = "0x0000000000000000000000000000000000000000".equalsIgnoreCase(permit.path("sourceAsset").asText())
        ? permit.path("amountInRaw").asText() : "0";
    return new ExecutionTx(permit.path("sourceChainId").asLong(), permit.path("payer").asText(),
        target, permitCall("fillDirect", permit, parts.signature()), value);
  }

  public static String previewCallData(JsonNode envelope) {
    PermitParts parts = permitParts(envelope);
    return permitCall("previewFillDirect", parts.permit(), parts.signature());
  }

  public static String resolveCallData(String payload) {
    try {
      return FunctionEncoder.encode(new Function("resolveExecution",
          List.of(new DynamicBytes(Numeric.hexStringToByteArray(payload))),
          List.of(new TypeReference<ResolvedStruct>() {})));
    } catch (Exception error) {
      throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error);
    }
  }

  public static ResolutionResult decodeResolution(String raw) {
    try {
      var function = new Function("resolveExecution", List.of(new DynamicBytes(new byte[0])),
          List.of(new TypeReference<ResolvedStruct>() {}));
      List<Type> decoded = FunctionReturnDecoder.decode(raw, function.getOutputParameters());
      if (decoded.size() != 1) throw new IllegalArgumentException();
      ResolvedStruct value = (ResolvedStruct) decoded.get(0);
      return new ResolutionResult(DEFAULT_RESOLVER, Numeric.toHexString(value.routeId.getValue()),
          Numeric.toHexString(value.quoteId.getValue()), value.target.getValue(),
          value.value.getValue().toString(), Numeric.toHexString(value.callData.getValue()), raw);
    } catch (Exception error) {
      throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error);
    }
  }

  public static PreviewResult decodePreview(String raw) {
    try {
      var function = new Function("previewFillDirect", List.of(),
          List.of(new TypeReference<Bool>() {}, new TypeReference<Bytes32>() {}));
      List<Type> decoded = FunctionReturnDecoder.decode(raw, function.getOutputParameters());
      if (decoded.size() != 2) throw new IllegalArgumentException();
      return new PreviewResult((Boolean) decoded.get(0).getValue(),
          Numeric.toHexString((byte[]) decoded.get(1).getValue()).toLowerCase(Locale.ROOT), raw);
    } catch (Exception error) {
      throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error);
    }
  }
}
