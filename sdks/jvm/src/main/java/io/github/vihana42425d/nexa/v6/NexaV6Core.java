package io.github.vihana42425d.nexa.v6;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Keys;
import org.web3j.crypto.ECDSASignature;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

public final class NexaV6Core {
  public static final String FEED_DOMAIN = "NEXA_MAINNET_V6_SIGNED_FEED_V1";
  public static final String PERMIT_REQUEST_DOMAIN = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1";
  public static final String DEFAULT_BASE_URL = "https://solver.vsnexa.com";
  public static final String DEFAULT_DISCOVERY_URI = "https://solver.vsnexa.com/.well-known/nexa-solver.json";
  public static final String DEFAULT_RESOLVER = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522";
  public static final ObjectMapper JSON = new ObjectMapper();
  private static final Pattern BYTES32 = Pattern.compile("^0x[0-9a-fA-F]{64}$");

  private NexaV6Core() {}

  public record FeedVerification(boolean valid, String computedHash, String expectedHash,
      String recoveredSigner, String declaredSigner, String expectedSigner, boolean expired) {}

  public static String canonicalJson(JsonNode value) {
    if (value == null || value.isNull()) return "null";
    if (value.isArray()) {
      var values = new ArrayList<String>();
      value.forEach(item -> values.add(canonicalJson(item)));
      return "[" + String.join(",", values) + "]";
    }
    if (value.isObject()) {
      var fields = new ArrayList<Map.Entry<String, JsonNode>>();
      value.fields().forEachRemaining(fields::add);
      fields.sort(Comparator.comparing(Map.Entry::getKey));
      var values = new ArrayList<String>();
      for (var field : fields) {
        try {
          values.add(JSON.writeValueAsString(field.getKey()) + ":" + canonicalJson(field.getValue()));
        } catch (Exception error) {
          throw new NexaSdkException("NEXA_SDK_FEED_INVALID", error);
        }
      }
      return "{" + String.join(",", values) + "}";
    }
    return value.toString();
  }

  public static String computeFeedHash(JsonNode payload) {
    byte[] digest = Hash.sha3((FEED_DOMAIN + "\n" + canonicalJson(payload)).getBytes(StandardCharsets.UTF_8));
    return Numeric.toHexString(digest).toLowerCase(Locale.ROOT);
  }

  private static String address(String value) {
    try { return Keys.toChecksumAddress(value); } catch (Exception ignored) { return null; }
  }

  public static FeedVerification verifyFeed(JsonNode feed, String expectedSigner, long nowSeconds, boolean required) {
    JsonNode payload = feed.has("signedPayload") ? feed.get("signedPayload") : (feed.has("payload") ? feed.get("payload") : feed);
    if (!FEED_DOMAIN.equals(payload.path("schema").asText()) || !payload.path("routes").isArray()) {
      throw new NexaSdkException("NEXA_SDK_FEED_INVALID");
    }
    String computed = computeFeedHash(payload);
    String expectedHash = feed.path("feedHash").asText("").toLowerCase(Locale.ROOT);
    String declared = address(feed.path("feedSigner").asText());
    String expected = address(expectedSigner == null ? feed.path("feedSigner").asText() : expectedSigner);
    String recovered = null;
    try {
      byte[] digest = Numeric.hexStringToByteArray(computed);
      byte[] signature = Numeric.hexStringToByteArray(feed.path("feedSignature").asText());
      if (signature.length != 65) throw new IllegalArgumentException();
      int recovery = signature[64] & 0xff;
      if (recovery >= 27) recovery -= 27;
      byte[] r = java.util.Arrays.copyOfRange(signature, 0, 32);
      byte[] s = java.util.Arrays.copyOfRange(signature, 32, 64);
      var key = Sign.recoverFromSignature(recovery,
          new ECDSASignature(new BigInteger(1, r), new BigInteger(1, s)), digest);
      if (key != null) recovered = Keys.toChecksumAddress("0x" + Keys.getAddress(key));
    } catch (Exception ignored) {}
    if (nowSeconds == 0) nowSeconds = Instant.now().getEpochSecond();
    boolean expired = payload.path("validUntil").asLong() <= nowSeconds;
    boolean valid = computed.equalsIgnoreCase(expectedHash) && recovered != null && declared != null && expected != null
        && recovered.equalsIgnoreCase(declared) && declared.equalsIgnoreCase(expected)
        && payload.path("generatedAt").asLong() <= nowSeconds && !expired;
    var result = new FeedVerification(valid, computed, expectedHash, recovered, declared, expected, expired);
    if (required && !valid) {
      String code = !computed.equalsIgnoreCase(expectedHash) ? "NEXA_SDK_FEED_HASH_MISMATCH"
          : expired ? "NEXA_SDK_FEED_EXPIRED" : "NEXA_SDK_FEED_SIGNER_MISMATCH";
      throw new NexaSdkException(code, result);
    }
    return result;
  }

  private static String bytes32(JsonNode value) {
    String result = value.asText("").toLowerCase(Locale.ROOT);
    if (!BYTES32.matcher(result).matches()) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    return result;
  }

  public static String requestPermitMessage(JsonNode input) {
    String quoteId = bytes32(input.path("quoteId"));
    BigInteger amount;
    try { amount = new BigInteger(input.path("requestedAmountInRaw").asText()); }
    catch (Exception error) { throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID"); }
    String standard = input.path("standard").asText("DIRECT").toUpperCase(Locale.ROOT);
    String idempotency = input.path("idempotencyKey").asText().trim();
    if (amount.signum() <= 0 || amount.bitLength() > 128 || idempotency.length() < 8 || idempotency.length() > 128) {
      throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    }
    var lines = new ArrayList<>(List.of(PERMIT_REQUEST_DOMAIN, "quoteId=" + quoteId,
        "requestedAmountInRaw=" + amount, "standard=" + standard));
    appendParty(lines, input, "payer");
    appendParty(lines, input, "recipient");
    lines.add("idempotencyKey=" + idempotency);
    return String.join("\n", lines);
  }

  private static void appendParty(List<String> lines, JsonNode input, String name) {
    String evmAddress = address(input.path(name).asText());
    if (evmAddress != null) {
      lines.add(name + "=" + evmAddress.toLowerCase(Locale.ROOT));
      return;
    }
    String accountId = bytes32(input.path(name + "AccountId"));
    JsonNode locator = input.get(name + "Locator");
    if (locator == null) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    if (locator.isTextual()) {
      ObjectNode wrapped = JSON.createObjectNode();
      wrapped.put("native", locator.asText());
      locator = wrapped;
    }
    if (!locator.isObject()) throw new NexaSdkException("NEXA_SDK_PERMIT_REQUEST_INVALID");
    lines.add(name + "AccountId=" + accountId + "\n" + name + "Locator=" + canonicalJson(locator));
  }
}
