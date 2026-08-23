using System.Text.Json;
using Nexa.V6.Sdk;
using Xunit;

namespace Nexa.V6.Sdk.Tests;

public sealed class ConformanceTests
{
    private static JsonElement Vectors()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "test-vectors.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return document.RootElement.Clone();
    }

    [Fact]
    public void CanonicalFeedAndSignatureMatchFrozenVectors()
    {
        var vectors = Vectors();
        var canonical = vectors.GetProperty("canonicalJson");
        Assert.Equal(canonical.GetProperty("expected").GetString(),
            NexaV6Core.CanonicalJson(canonical.GetProperty("input")));
        var feedVector = vectors.GetProperty("feed");
        Assert.Equal(feedVector.GetProperty("feedHash").GetString(),
            NexaV6Core.ComputeFeedHash(feedVector.GetProperty("signedPayload")));
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            signedPayload = feedVector.GetProperty("signedPayload"),
            feedHash = feedVector.GetProperty("feedHash"),
            feedSigner = feedVector.GetProperty("feedSigner"),
            feedSignature = feedVector.GetProperty("feedSignature")
        }));
        var result = NexaV6Core.VerifyFeed(document.RootElement,
            feedVector.GetProperty("feedSigner").GetString(),
            feedVector.GetProperty("nowSeconds").GetInt64(), true);
        Assert.True(result.Valid);
        Assert.Equal(feedVector.GetProperty("feedSigner").GetString()?.ToLowerInvariant(),
            result.RecoveredSigner);
    }

    [Fact]
    public void PermitMessageAndCalldataMatchFrozenVectors()
    {
        var vectors = Vectors();
        var permitRequest = vectors.GetProperty("permitRequest");
        Assert.Equal(permitRequest.GetProperty("expectedMessage").GetString(),
            NexaV6Core.RequestPermitMessage(permitRequest.GetProperty("request")));
        var abi = vectors.GetProperty("abi");
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            permit = abi.GetProperty("permit"),
            permitSignature = abi.GetProperty("permitSignature"),
            execution = new { target = abi.GetProperty("executionTarget") }
        }));
        var transaction = NexaV6Abi.BuildExecutionTx(document.RootElement);
        Assert.Equal(abi.GetProperty("fillDirectCallData").GetString(), transaction.Data);
        Assert.Equal(abi.GetProperty("expectedTransactionValue").GetString(), transaction.Value);
    }

    [Fact]
    public void AllFrozenOperationsArePresent()
    {
        var methods = typeof(NexaV6Client).GetMethods().Select(method => method.Name).ToHashSet();
        foreach (var name in new[] { "Discover", "GetRoutes", "GetRoute", "VerifyFeed",
                     "RequestPermitMessage", "RequestPermit", "ResolveExecution",
                     "PreviewExecution", "BuildExecutionTx", "GetFillStatus" })
            Assert.Contains(name, methods);
    }
}
