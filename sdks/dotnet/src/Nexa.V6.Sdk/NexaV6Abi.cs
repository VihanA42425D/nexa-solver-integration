using System.Numerics;
using System.Text;
using System.Text.Json;
using Nethereum.Util;

namespace Nexa.V6.Sdk;

public static class NexaV6Abi
{
    private const string PermitTuple = "(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes32,uint64,uint64,uint32,uint32,uint256,uint256,address,address,address,address,address,address,address,uint128,uint128)";
    private static readonly string[] HashFields = {
        "releaseId", "fillId", "routeId", "quoteId", "policyHash", "permitNonce",
        "sourceNetworkId", "sourceAssetId", "destinationNetworkId", "destinationAssetId",
        "sourceVaultAccountId", "destinationVaultAccountId", "payerAccountId", "recipientAccountId"
    };

    public sealed record ExecutionTx(long ChainId, string From, string To, string Data, string Value);
    public sealed record ResolutionResult(string Resolver, string RouteId, string QuoteId,
        string Target, string Value, string CallData, string RawReturnData);
    public sealed record PreviewResult(bool Valid, string Reason, string RawReturnData);

    private static byte[] Hex(string value)
    {
        if (value.StartsWith("0x", StringComparison.OrdinalIgnoreCase)) value = value[2..];
        try { return Convert.FromHexString(value); }
        catch { throw new NexaSdkException("NEXA_SDK_ABI_ERROR"); }
    }

    private static string HexString(IEnumerable<byte> value) =>
        "0x" + Convert.ToHexString(value.ToArray()).ToLowerInvariant();

    private static byte[] Word(BigInteger value)
    {
        if (value < 0 || value.GetByteCount(isUnsigned: true) > 32)
            throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
        var bytes = value.ToByteArray(isUnsigned: true, isBigEndian: true);
        return Enumerable.Repeat((byte)0, 32 - bytes.Length).Concat(bytes).ToArray();
    }

    private static byte[] FixedWord(string value, int exactBytes)
    {
        var bytes = Hex(value);
        if (bytes.Length != exactBytes) throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
        return Enumerable.Repeat((byte)0, 32 - bytes.Length).Concat(bytes).ToArray();
    }

    private static BigInteger Integer(JsonElement permit, string name)
    {
        if (!BigInteger.TryParse(NexaV6Core.ReadString(permit.GetProperty(name)), out var value) || value < 0)
            throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
        return value;
    }

    private static (JsonElement Row, JsonElement Permit, byte[] Signature) PermitParts(JsonElement envelope)
    {
        var row = envelope;
        if (envelope.TryGetProperty("permit", out var outer)
            && outer.ValueKind == JsonValueKind.Object && outer.TryGetProperty("permit", out _))
            row = outer;
        if (!row.TryGetProperty("permit", out var permit) || permit.ValueKind != JsonValueKind.Object
            || !row.TryGetProperty("permitSignature", out var signatureNode))
            throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
        var signature = Hex(signatureNode.GetString()!);
        if (signature.Length != 65) throw new NexaSdkException("NEXA_SDK_ABI_ERROR");
        return (row, permit, signature);
    }

    private static string PermitCall(string method, JsonElement permit, byte[] signature)
    {
        var output = new List<byte>();
        var selector = new Sha3Keccack().CalculateHash(
            Encoding.UTF8.GetBytes(method + "(" + PermitTuple + ",bytes)"))[..4];
        output.AddRange(selector);
        foreach (var name in HashFields) output.AddRange(FixedWord(permit.GetProperty(name).GetString()!, 32));
        output.AddRange(Word(Integer(permit, "dataVersion")));
        output.AddRange(FixedWord(permit.GetProperty("executionGeneration").GetString()!, 32));
        output.AddRange(Word(Integer(permit, "validAfter")));
        output.AddRange(Word(Integer(permit, "validUntil")));
        output.AddRange(Word(Integer(permit, "sourceFinalityBlocks")));
        output.AddRange(Word(Integer(permit, "settlementWindowSeconds")));
        output.AddRange(Word(Integer(permit, "sourceChainId")));
        output.AddRange(Word(Integer(permit, "destinationChainId")));
        foreach (var name in new[] { "sourceAsset", "destinationAsset", "sourceVault", "destinationVault",
                     "sourceRouter", "payer", "recipient" })
            output.AddRange(FixedWord(permit.GetProperty(name).GetString()!, 20));
        output.AddRange(Word(Integer(permit, "amountInRaw")));
        output.AddRange(Word(Integer(permit, "amountOutRaw")));
        output.AddRange(Word(32 * 32));
        output.AddRange(Word(signature.Length));
        output.AddRange(signature);
        output.AddRange(Enumerable.Repeat((byte)0, (32 - signature.Length % 32) % 32));
        return HexString(output);
    }

    public static ExecutionTx BuildExecutionTx(JsonElement envelope)
    {
        var parts = PermitParts(envelope);
        var permit = parts.Permit;
        var target = parts.Row.TryGetProperty("execution", out var execution)
            && execution.TryGetProperty("target", out var targetNode)
            ? targetNode.GetString()! : permit.GetProperty("sourceRouter").GetString()!;
        var sourceAsset = permit.GetProperty("sourceAsset").GetString()!;
        var value = sourceAsset.Equals("0x0000000000000000000000000000000000000000",
            StringComparison.OrdinalIgnoreCase) ? NexaV6Core.ReadString(permit.GetProperty("amountInRaw")) : "0";
        return new ExecutionTx((long)Integer(permit, "sourceChainId"),
            permit.GetProperty("payer").GetString()!, target,
            PermitCall("fillDirect", permit, parts.Signature), value);
    }

    public static string PreviewCallData(JsonElement envelope)
    {
        var parts = PermitParts(envelope);
        return PermitCall("previewFillDirect", parts.Permit, parts.Signature);
    }

    public static string ResolveCallData(string payload)
    {
        var bytes = Hex(payload);
        var output = new List<byte>();
        output.AddRange(new Sha3Keccack().CalculateHash(Encoding.UTF8.GetBytes("resolveExecution(bytes)"))[..4]);
        output.AddRange(Word(32));
        output.AddRange(Word(bytes.Length));
        output.AddRange(bytes);
        output.AddRange(Enumerable.Repeat((byte)0, (32 - bytes.Length % 32) % 32));
        return HexString(output);
    }

    private static int Offset(byte[] data, int position) =>
        checked((int)new BigInteger(data.AsSpan(position, 32), isUnsigned: true, isBigEndian: true));

    public static ResolutionResult DecodeResolution(string raw)
    {
        try
        {
            var data = Hex(raw);
            var tuple = Offset(data, 0);
            var routeId = HexString(data.AsSpan(tuple, 32).ToArray());
            var quoteId = HexString(data.AsSpan(tuple + 32, 32).ToArray());
            var target = HexString(data.AsSpan(tuple + 64 + 12, 20).ToArray());
            var value = new BigInteger(data.AsSpan(tuple + 96, 32), true, true).ToString();
            var dynamic = tuple + Offset(data, tuple + 128);
            var length = Offset(data, dynamic);
            var callData = HexString(data.AsSpan(dynamic + 32, length).ToArray());
            return new ResolutionResult(NexaV6Core.DefaultResolver, routeId, quoteId, target, value, callData, raw);
        }
        catch (NexaSdkException) { throw; }
        catch (Exception error) { throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error); }
    }

    public static PreviewResult DecodePreview(string raw)
    {
        try
        {
            var data = Hex(raw);
            var valid = new BigInteger(data.AsSpan(0, 32), true, true) != 0;
            return new PreviewResult(valid, HexString(data.AsSpan(32, 32).ToArray()), raw);
        }
        catch (Exception error) { throw new NexaSdkException("NEXA_SDK_ABI_ERROR", error); }
    }
}
