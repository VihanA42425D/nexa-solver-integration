using System.Numerics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Nethereum.Signer;
using Nethereum.Util;

namespace Nexa.V6.Sdk;

public static class NexaV6Core
{
    public const string FeedDomain = "NEXA_MAINNET_V6_SIGNED_FEED_V1";
    public const string PermitRequestDomain = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1";
    public const string DefaultBaseUrl = "https://solver.vsnexa.com";
    public const string DefaultDiscoveryUri = "https://solver.vsnexa.com/.well-known/nexa-solver.json";
    public const string DefaultResolver = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522";
    private static readonly JsonSerializerOptions CanonicalJsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public sealed record FeedVerification(bool Valid, string ComputedHash, string ExpectedHash,
        string? RecoveredSigner, string? DeclaredSigner, string? ExpectedSigner, bool Expired);

    public static string CanonicalJson(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.Object => "{" + string.Join(",", value.EnumerateObject()
                .OrderBy(field => field.Name, StringComparer.Ordinal)
                .Select(field => JsonSerializer.Serialize(field.Name, CanonicalJsonOptions) + ":" + CanonicalJson(field.Value))) + "}",
            JsonValueKind.Array => "[" + string.Join(",", value.EnumerateArray().Select(CanonicalJson)) + "]",
            JsonValueKind.String => JsonSerializer.Serialize(value.GetString(), CanonicalJsonOptions),
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => "null",
            _ => throw new NexaSdkException("NEXA_SDK_FEED_INVALID")
        };
    }

    public static string ComputeFeedHash(JsonElement payload)
    {
        var digest = new Sha3Keccack().CalculateHash(
            Encoding.UTF8.GetBytes(FeedDomain + "\n" + CanonicalJson(payload)));
        return "0x" + Convert.ToHexString(digest).ToLowerInvariant();
    }

    private static string? Address(string? value)
    {
        if (value is null || !System.Text.RegularExpressions.Regex.IsMatch(value, "^0x[0-9a-fA-F]{40}$"))
            return null;
        return value.ToLowerInvariant();
    }

    public static FeedVerification VerifyFeed(JsonElement feed, string? expectedSigner = null,
        long nowSeconds = 0, bool required = false)
    {
        var payload = feed.TryGetProperty("signedPayload", out var signed) ? signed
            : feed.TryGetProperty("payload", out var wrapped) ? wrapped : feed;
        if (!payload.TryGetProperty("schema", out var schema) || schema.GetString() != FeedDomain
            || !payload.TryGetProperty("routes", out var routes) || routes.ValueKind != JsonValueKind.Array)
            throw new NexaSdkException("NEXA_SDK_FEED_INVALID");
        var computed = ComputeFeedHash(payload);
        var expectedHash = feed.TryGetProperty("feedHash", out var hashNode)
            ? (hashNode.GetString() ?? "").ToLowerInvariant() : "";
        var declared = Address(feed.TryGetProperty("feedSigner", out var signerNode) ? signerNode.GetString() : null);
        var expected = Address(expectedSigner ?? declared);
        string? recovered = null;
        try
        {
            var signature = EthECDSASignatureFactory.ExtractECDSASignature(
                feed.GetProperty("feedSignature").GetString()!);
            var key = EthECKey.RecoverFromSignature(signature,
                Convert.FromHexString(computed[2..]));
            recovered = key?.GetPublicAddress().ToLowerInvariant();
        }
        catch { }
        if (nowSeconds == 0) nowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var generatedAt = ReadInt64(payload.GetProperty("generatedAt"));
        var validUntil = ReadInt64(payload.GetProperty("validUntil"));
        var expired = validUntil <= nowSeconds;
        var valid = computed.Equals(expectedHash, StringComparison.OrdinalIgnoreCase)
            && recovered is not null && declared is not null && expected is not null
            && recovered.Equals(declared, StringComparison.OrdinalIgnoreCase)
            && declared.Equals(expected, StringComparison.OrdinalIgnoreCase)
            && generatedAt <= nowSeconds && !expired;
        var result = new FeedVerification(valid, computed, expectedHash, recovered, declared, expected, expired);
        if (required && !valid)
        {
            var code = !computed.Equals(expectedHash, StringComparison.OrdinalIgnoreCase)
                ? "NEXA_SDK_FEED_HASH_MISMATCH"
                : expired ? "NEXA_SDK_FEED_EXPIRED" : "NEXA_SDK_FEED_SIGNER_MISMATCH";
            throw new NexaSdkException(code, result);
        }
        return result;
    }

    public static string RequestPermitMessage(JsonElement input)
    {
        var quoteId = Bytes32(input.GetProperty("quoteId").GetString());
        if (!BigInteger.TryParse(ReadString(input.GetProperty("requestedAmountInRaw")), out var amount)
            || amount <= 0 || amount >= (BigInteger.One << 128))
            throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
        var standard = input.TryGetProperty("standard", out var standardNode)
            ? standardNode.GetString()!.ToUpperInvariant() : "DIRECT";
        var idempotency = input.GetProperty("idempotencyKey").GetString()!.Trim();
        if (idempotency.Length < 8 || idempotency.Length > 128)
            throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
        var lines = new List<string> { PermitRequestDomain, "quoteId=" + quoteId,
            "requestedAmountInRaw=" + amount, "standard=" + standard };
        AppendParty(lines, input, "payer");
        AppendParty(lines, input, "recipient");
        lines.Add("idempotencyKey=" + idempotency);
        return string.Join("\n", lines);
    }

    private static void AppendParty(List<string> lines, JsonElement input, string name)
    {
        var evm = input.TryGetProperty(name, out var addressNode) ? Address(addressNode.GetString()) : null;
        if (evm is not null) { lines.Add(name + "=" + evm); return; }
        var accountId = Bytes32(input.GetProperty(name + "AccountId").GetString());
        var locator = input.GetProperty(name + "Locator");
        if (locator.ValueKind == JsonValueKind.String)
        {
            using var wrapped = JsonDocument.Parse(JsonSerializer.Serialize(new Dictionary<string, string>
                { ["native"] = locator.GetString()! }));
            lines.Add(name + "AccountId=" + accountId + "\n" + name + "Locator=" + CanonicalJson(wrapped.RootElement));
            return;
        }
        if (locator.ValueKind != JsonValueKind.Object) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
        lines.Add(name + "AccountId=" + accountId + "\n" + name + "Locator=" + CanonicalJson(locator));
    }

    internal static string Bytes32(string? value)
    {
        if (value is null || !System.Text.RegularExpressions.Regex.IsMatch(value, "^0x[0-9a-fA-F]{64}$"))
            throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
        return value.ToLowerInvariant();
    }

    internal static string ReadString(JsonElement value) =>
        value.ValueKind == JsonValueKind.String ? value.GetString()! : value.GetRawText();

    internal static long ReadInt64(JsonElement value) => long.Parse(ReadString(value));
}
