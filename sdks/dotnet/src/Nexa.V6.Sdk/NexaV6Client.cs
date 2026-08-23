using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Nexa.V6.Sdk;

public sealed class NexaV6Client
{
    private static readonly Regex Signature = new("^0x[0-9a-fA-F]{130}$", RegexOptions.Compiled);
    private readonly HttpClient http;
    public string DiscoveryUri { get; }
    public string? ExpectedFeedSigner { get; }

    public sealed record RoutesResult(JsonElement Feed, JsonElement Routes,
        NexaV6Core.FeedVerification Verification);

    public NexaV6Client(string? discoveryUri = null, string? expectedFeedSigner = null, HttpClient? http = null)
    {
        DiscoveryUri = discoveryUri ?? NexaV6Core.DefaultDiscoveryUri;
        ExpectedFeedSigner = expectedFeedSigner;
        this.http = http ?? new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
            { Timeout = TimeSpan.FromSeconds(30) };
    }

    private async Task<JsonElement> Request(string method, string endpoint, JsonElement? body = null,
        IReadOnlyDictionary<string, string>? headers = null, CancellationToken cancellationToken = default)
    {
        try
        {
            using var request = new HttpRequestMessage(new HttpMethod(method), endpoint);
            request.Headers.Accept.ParseAdd("application/json");
            if (headers is not null)
                foreach (var header in headers) request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            if (body is not null)
                request.Content = new StringContent(body.Value.GetRawText(), Encoding.UTF8, "application/json");
            using var response = await http.SendAsync(request, cancellationToken).ConfigureAwait(false);
            var raw = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            using var document = JsonDocument.Parse(raw);
            var result = document.RootElement.Clone();
            if (!response.IsSuccessStatusCode)
            {
                var serverCode = result.TryGetProperty("error", out var error) ? error.GetString() : null;
                throw new NexaSdkException("NEXA_SDK_HTTP_ERROR", (int)response.StatusCode, serverCode);
            }
            return result;
        }
        catch (NexaSdkException) { throw; }
        catch (Exception error) { throw new NexaSdkException("NEXA_SDK_HTTP_ERROR", error); }
    }

    public async Task<JsonElement> Discover(CancellationToken cancellationToken = default)
    {
        var discovery = await Request("GET", DiscoveryUri, cancellationToken: cancellationToken);
        if (discovery.GetProperty("schema").GetString() != "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2"
            || discovery.GetProperty("deploymentVersion").GetInt32() != 6
            || discovery.GetProperty("deploymentStatus").GetString() != "ACTIVE"
            || !Regex.IsMatch(discovery.GetProperty("releaseId").GetString() ?? "", "^0x[0-9a-fA-F]{64}$")
            || !Regex.IsMatch(discovery.GetProperty("feedSigner").GetString() ?? "", "^0x[0-9a-fA-F]{40}$")
            || string.IsNullOrWhiteSpace(discovery.GetProperty("endpoints").GetProperty("solverFeed").GetString()))
            throw new NexaSdkException("NEXA_SDK_DISCOVERY_INVALID");
        return discovery;
    }

    public async Task<RoutesResult> GetRoutes(IReadOnlyDictionary<string, object?>? query = null,
        CancellationToken cancellationToken = default)
    {
        var discovery = await Discover(cancellationToken);
        var endpoint = discovery.GetProperty("endpoints").GetProperty("solverFeed").GetString()!;
        var parameters = new List<string>();
        if (query?.TryGetValue("sourceChainId", out var chainId) == true && chainId is not null)
            parameters.Add("sourceChainId=" + Uri.EscapeDataString(chainId.ToString()!));
        if (query?.TryGetValue("sourceNetworkId", out var networkId) == true && networkId is not null)
            parameters.Add("sourceNetworkId=" + Uri.EscapeDataString(NexaV6Core.Bytes32(networkId.ToString())));
        if (parameters.Count > 0) endpoint += (endpoint.Contains('?') ? "&" : "?") + string.Join("&", parameters);
        var body = await Request("GET", endpoint, cancellationToken: cancellationToken);
        var feed = body.TryGetProperty("feed", out var wrapped) ? wrapped : body;
        var signer = ExpectedFeedSigner ?? discovery.GetProperty("feedSigner").GetString();
        var verification = NexaV6Core.VerifyFeed(feed, signer, required: true);
        var payload = feed.TryGetProperty("signedPayload", out var signed) ? signed : feed;
        return new RoutesResult(feed.Clone(), payload.GetProperty("routes").Clone(), verification);
    }

    public async Task<JsonElement> GetRoute(string routeId, CancellationToken cancellationToken = default)
    {
        routeId = NexaV6Core.Bytes32(routeId);
        var discovery = await Discover(cancellationToken);
        var endpoint = discovery.GetProperty("endpoints").GetProperty("routeDetailTemplate").GetString()!
            .Replace("{routeId}", routeId, StringComparison.Ordinal);
        var body = await Request("GET", endpoint, cancellationToken: cancellationToken);
        return body.TryGetProperty("route", out var route) ? route.Clone() : body;
    }

    public NexaV6Core.FeedVerification VerifyFeed(JsonElement feed, string? expectedSigner = null,
        long nowSeconds = 0, bool required = false) =>
        NexaV6Core.VerifyFeed(feed, expectedSigner ?? ExpectedFeedSigner, nowSeconds, required);

    public string RequestPermitMessage(JsonElement input) => NexaV6Core.RequestPermitMessage(input);

    public async Task<JsonElement> RequestPermit(JsonElement input, string requestSignature,
        CancellationToken cancellationToken = default)
    {
        if (!Signature.IsMatch(requestSignature ?? "")) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
        RequestPermitMessage(input);
        var discovery = await Discover(cancellationToken);
        var values = JsonSerializer.Deserialize<Dictionary<string, object?>>(input.GetRawText())!;
        values["requestSignature"] = requestSignature;
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(values));
        return await Request("POST", discovery.GetProperty("endpoints").GetProperty("executionPermits").GetString()!,
            document.RootElement, new Dictionary<string, string>
            { ["idempotency-key"] = input.GetProperty("idempotencyKey").GetString()! }, cancellationToken);
    }

    private async Task<string> Rpc(string rpcUrl, string method, object[] parameters,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(new
            { jsonrpc = "2.0", id = 1, method, @params = parameters }));
        var response = await Request("POST", rpcUrl, document.RootElement, cancellationToken: cancellationToken);
        if (response.TryGetProperty("error", out var error) || !response.GetProperty("result").ValueKind.Equals(JsonValueKind.String))
            throw new NexaSdkException("NEXA_SDK_RPC_ERROR", error.ValueKind == JsonValueKind.Undefined ? response : error);
        return response.GetProperty("result").GetString()!;
    }

    public async Task<NexaV6Abi.ResolutionResult> ResolveExecution(string rpcUrl, string payload,
        CancellationToken cancellationToken = default)
    {
        var raw = await Rpc(rpcUrl, "eth_call", new object[] {
            new { to = NexaV6Core.DefaultResolver, data = NexaV6Abi.ResolveCallData(payload) }, "latest"
        }, cancellationToken);
        return NexaV6Abi.DecodeResolution(raw);
    }

    public async Task<NexaV6Abi.PreviewResult> PreviewExecution(string rpcUrl, JsonElement envelope,
        CancellationToken cancellationToken = default)
    {
        var permit = envelope.GetProperty("permit");
        if (permit.TryGetProperty("permit", out var nested)) permit = nested;
        var raw = await Rpc(rpcUrl, "eth_call", new object[] {
            new { to = permit.GetProperty("sourceRouter").GetString(),
                from = permit.GetProperty("payer").GetString(), data = NexaV6Abi.PreviewCallData(envelope) }, "latest"
        }, cancellationToken);
        return NexaV6Abi.DecodePreview(raw);
    }

    public NexaV6Abi.ExecutionTx BuildExecutionTx(JsonElement envelope) =>
        NexaV6Abi.BuildExecutionTx(envelope);

    public async Task<JsonElement> GetFillStatus(string fillId, CancellationToken cancellationToken = default)
    {
        fillId = NexaV6Core.Bytes32(fillId);
        var discovery = await Discover(cancellationToken);
        var endpoint = discovery.GetProperty("endpoints").GetProperty("permitStatusTemplate").GetString()!
            .Replace("{fillId}", fillId, StringComparison.Ordinal);
        var body = await Request("GET", endpoint, cancellationToken: cancellationToken);
        return body.TryGetProperty("permit", out var permit) ? permit.Clone() : body;
    }
}
