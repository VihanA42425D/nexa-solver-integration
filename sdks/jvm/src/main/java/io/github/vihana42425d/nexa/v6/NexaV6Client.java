package io.github.vihana42425d.nexa.v6;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;

public final class NexaV6Client {
  private static final Pattern SIGNATURE = Pattern.compile("^0x[0-9a-fA-F]{130}$");
  private final String discoveryUri;
  private final String expectedFeedSigner;
  private final HttpClient http;

  public record RoutesResult(JsonNode feed, JsonNode routes, NexaV6Core.FeedVerification verification) {}

  public NexaV6Client() { this(NexaV6Core.DEFAULT_DISCOVERY_URI, null, null); }
  public NexaV6Client(String discoveryUri, String expectedFeedSigner, HttpClient http) {
    this.discoveryUri = discoveryUri == null ? NexaV6Core.DEFAULT_DISCOVERY_URI : discoveryUri;
    this.expectedFeedSigner = expectedFeedSigner;
    this.http = http == null ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30))
        .followRedirects(HttpClient.Redirect.NEVER).build() : http;
  }

  private JsonNode request(String method, String endpoint, JsonNode body, Map<String, String> headers) {
    try {
      var builder = HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(30))
          .header("accept", "application/json");
      headers.forEach(builder::header);
      if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
      else builder.method(method, HttpRequest.BodyPublishers.ofString(NexaV6Core.JSON.writeValueAsString(body)))
          .header("content-type", "application/json");
      var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      JsonNode decoded = NexaV6Core.JSON.readTree(response.body());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new NexaSdkException("NEXA_SDK_HTTP_ERROR", decoded.path("error").asText(null), response.statusCode());
      }
      return decoded;
    } catch (NexaSdkException error) {
      throw error;
    } catch (Exception error) {
      throw new NexaSdkException("NEXA_SDK_HTTP_ERROR", error);
    }
  }

  public JsonNode discover() {
    JsonNode discovery = request("GET", discoveryUri, null, Map.of());
    if (!"NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2".equals(discovery.path("schema").asText())
        || discovery.path("deploymentVersion").asInt() != 6
        || !"ACTIVE".equals(discovery.path("deploymentStatus").asText())
        || !discovery.path("releaseId").asText().matches("^0x[0-9a-fA-F]{64}$")
        || !discovery.path("feedSigner").asText().matches("^0x[0-9a-fA-F]{40}$")
        || discovery.path("endpoints").path("solverFeed").asText().isBlank()) {
      throw new NexaSdkException("NEXA_SDK_DISCOVERY_INVALID");
    }
    return discovery;
  }

  public RoutesResult getRoutes(Map<String, ?> query) {
    JsonNode discovery = discover();
    String endpoint = discovery.path("endpoints").path("solverFeed").asText();
    var params = new StringBuilder();
    if (query != null && query.get("sourceChainId") != null) {
      params.append("sourceChainId=").append(encode(String.valueOf(query.get("sourceChainId"))));
    }
    if (query != null && query.get("sourceNetworkId") != null) {
      if (params.length() > 0) params.append('&');
      params.append("sourceNetworkId=").append(encode(String.valueOf(query.get("sourceNetworkId")).toLowerCase()));
    }
    if (params.length() > 0) endpoint += (endpoint.contains("?") ? "&" : "?") + params;
    JsonNode body = request("GET", endpoint, null, Map.of());
    JsonNode feed = body.has("feed") ? body.get("feed") : body;
    String signer = expectedFeedSigner == null ? discovery.path("feedSigner").asText() : expectedFeedSigner;
    var verification = NexaV6Core.verifyFeed(feed, signer, 0, true);
    JsonNode payload = feed.has("signedPayload") ? feed.get("signedPayload") : feed;
    return new RoutesResult(feed, payload.path("routes"), verification);
  }

  public JsonNode getRoute(String routeId) {
    if (!routeId.matches("^0x[0-9a-fA-F]{64}$")) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    JsonNode discovery = discover();
    String endpoint = discovery.path("endpoints").path("routeDetailTemplate").asText()
        .replace("{routeId}", routeId.toLowerCase());
    JsonNode body = request("GET", endpoint, null, Map.of());
    return body.has("route") ? body.get("route") : body;
  }

  public NexaV6Core.FeedVerification verifyFeed(JsonNode feed, String signer, long nowSeconds, boolean required) {
    return NexaV6Core.verifyFeed(feed, signer == null ? expectedFeedSigner : signer, nowSeconds, required);
  }

  public String requestPermitMessage(JsonNode input) { return NexaV6Core.requestPermitMessage(input); }

  public JsonNode requestPermit(JsonNode input, String requestSignature) {
    if (!SIGNATURE.matcher(requestSignature == null ? "" : requestSignature).matches()) {
      throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    }
    requestPermitMessage(input);
    JsonNode discovery = discover();
    ObjectNode payload = input.deepCopy();
    payload.put("requestSignature", requestSignature);
    return request("POST", discovery.path("endpoints").path("executionPermits").asText(), payload,
        Map.of("idempotency-key", input.path("idempotencyKey").asText()));
  }

  private String rpc(String rpcUrl, String method, JsonNode params) {
    ObjectNode body = NexaV6Core.JSON.createObjectNode();
    body.put("jsonrpc", "2.0");
    body.put("id", 1);
    body.put("method", method);
    body.set("params", params);
    JsonNode response = request("POST", rpcUrl, body, Map.of());
    if (response.has("error") || !response.path("result").isTextual()) {
      throw new NexaSdkException("NEXA_SDK_RPC_ERROR", response);
    }
    return response.path("result").asText();
  }

  public NexaV6Abi.ResolutionResult resolveExecution(String rpcUrl, String payload) {
    var params = NexaV6Core.JSON.createArrayNode();
    ObjectNode call = params.addObject();
    call.put("to", NexaV6Core.DEFAULT_RESOLVER);
    call.put("data", NexaV6Abi.resolveCallData(payload));
    params.add("latest");
    return NexaV6Abi.decodeResolution(rpc(rpcUrl, "eth_call", params));
  }

  public NexaV6Abi.PreviewResult previewExecution(String rpcUrl, JsonNode envelope) {
    JsonNode permit = envelope.path("permit").path("permit").isObject()
        ? envelope.path("permit").path("permit") : envelope.path("permit");
    var params = NexaV6Core.JSON.createArrayNode();
    ObjectNode call = params.addObject();
    call.put("to", permit.path("sourceRouter").asText());
    call.put("from", permit.path("payer").asText());
    call.put("data", NexaV6Abi.previewCallData(envelope));
    params.add("latest");
    return NexaV6Abi.decodePreview(rpc(rpcUrl, "eth_call", params));
  }

  public NexaV6Abi.ExecutionTx buildExecutionTx(JsonNode envelope) {
    return NexaV6Abi.buildExecutionTx(envelope);
  }

  public JsonNode getFillStatus(String fillId) {
    if (!fillId.matches("^0x[0-9a-fA-F]{64}$")) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    JsonNode discovery = discover();
    String endpoint = discovery.path("endpoints").path("permitStatusTemplate").asText()
        .replace("{fillId}", fillId.toLowerCase());
    JsonNode body = request("GET", endpoint, null, Map.of());
    return body.has("permit") ? body.get("permit") : body;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
