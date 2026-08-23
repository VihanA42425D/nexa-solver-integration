package com.vsnexa.v6;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

final class ConformanceTest {
  private static JsonNode vectors;

  @BeforeAll
  static void loadVectors() throws Exception {
    vectors = NexaV6Core.JSON.readTree(Files.readString(
        Path.of("..", "..", "sdk-spec", "test-vectors.json")));
  }

  @Test
  void canonicalFeedAndSignatureMatchFrozenVectors() {
    assertEquals(vectors.path("canonicalJson").path("expected").asText(),
        NexaV6Core.canonicalJson(vectors.path("canonicalJson").path("input")));
    JsonNode feedVector = vectors.path("feed");
    assertEquals(feedVector.path("feedHash").asText(),
        NexaV6Core.computeFeedHash(feedVector.path("signedPayload")));
    var feed = NexaV6Core.JSON.createObjectNode();
    feed.set("signedPayload", feedVector.path("signedPayload"));
    feed.set("feedHash", feedVector.path("feedHash"));
    feed.set("feedSigner", feedVector.path("feedSigner"));
    feed.set("feedSignature", feedVector.path("feedSignature"));
    var result = NexaV6Core.verifyFeed(feed, feedVector.path("feedSigner").asText(),
        feedVector.path("nowSeconds").asLong(), true);
    assertTrue(result.valid());
    assertEquals(feedVector.path("feedSigner").asText(), result.recoveredSigner());
  }

  @Test
  void permitMessageAndCalldataMatchFrozenVectors() {
    JsonNode permitVector = vectors.path("permitRequest");
    assertEquals(permitVector.path("expectedMessage").asText(),
        NexaV6Core.requestPermitMessage(permitVector.path("request")));
    JsonNode abi = vectors.path("abi");
    var envelope = NexaV6Core.JSON.createObjectNode();
    envelope.set("permit", abi.path("permit"));
    envelope.set("permitSignature", abi.path("permitSignature"));
    var execution = envelope.putObject("execution");
    execution.set("target", abi.path("executionTarget"));
    var transaction = NexaV6Abi.buildExecutionTx(envelope);
    assertEquals(abi.path("fillDirectCallData").asText(), transaction.data());
    assertEquals(abi.path("expectedTransactionValue").asText(), transaction.value());
  }

  @Test
  void allFrozenOperationsArePresent() {
    Set<String> methods = java.util.Arrays.stream(NexaV6Client.class.getDeclaredMethods())
        .map(java.lang.reflect.Method::getName).collect(Collectors.toSet());
    for (String name : Set.of("discover", "getRoutes", "getRoute", "verifyFeed",
        "requestPermitMessage", "requestPermit", "resolveExecution", "previewExecution",
        "buildExecutionTx", "getFillStatus")) {
      assertTrue(methods.contains(name), name);
    }
  }
}
