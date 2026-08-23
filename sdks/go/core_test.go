package nexav6

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"testing"
)

func vectors(t *testing.T) map[string]any {
	t.Helper()
	_, current, _, _ := runtime.Caller(0)
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(current), "..", "..", "sdk-spec", "test-vectors.json"))
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value map[string]any
	if err := decoder.Decode(&value); err != nil {
		t.Fatal(err)
	}
	return value
}

func TestCanonicalFeedAndSignature(t *testing.T) {
	all := vectors(t)
	canonicalVector, _ := asMap(all["canonicalJson"])
	actual, err := CanonicalJSON(canonicalVector["input"])
	if err != nil || actual != canonicalVector["expected"] {
		t.Fatalf("canonical mismatch: %v %s", err, actual)
	}
	feedVector, _ := asMap(all["feed"])
	payload, _ := asMap(feedVector["signedPayload"])
	hash, err := ComputeFeedHash(payload)
	if err != nil || hash != feedVector["feedHash"] {
		t.Fatalf("feed hash mismatch: %v %s", err, hash)
	}
	feed := map[string]any{
		"signedPayload": payload, "feedHash": feedVector["feedHash"],
		"feedSigner": feedVector["feedSigner"], "feedSignature": feedVector["feedSignature"],
	}
	now, _ := strconv.ParseInt(fmt.Sprint(feedVector["nowSeconds"]), 10, 64)
	result, err := VerifyFeed(feed, fmt.Sprint(feedVector["feedSigner"]), now, true)
	if err != nil || !result.Valid {
		t.Fatalf("feed verification failed: %v %+v", err, result)
	}
}

func TestPermitAndExecutionCalldata(t *testing.T) {
	all := vectors(t)
	permitVector, _ := asMap(all["permitRequest"])
	request, _ := asMap(permitVector["request"])
	message, err := RequestPermitMessage(request)
	if err != nil || message != permitVector["expectedMessage"] {
		t.Fatalf("permit message mismatch: %v", err)
	}
	abiVector, _ := asMap(all["abi"])
	permit, _ := asMap(abiVector["permit"])
	transaction, err := BuildExecutionTx(map[string]any{
		"permit": permit, "permitSignature": abiVector["permitSignature"],
		"execution": map[string]any{"target": abiVector["executionTarget"]},
	})
	if err != nil {
		t.Fatal(err)
	}
	if transaction.Data != abiVector["fillDirectCallData"] {
		t.Fatal("fillDirect calldata mismatch")
	}
	if transaction.Value != abiVector["expectedTransactionValue"] {
		t.Fatal("transaction value mismatch")
	}
}

func TestFrozenOperationsCompile(t *testing.T) {
	client := NewClient()
	_ = client.Discover
	_ = client.GetRoutes
	_ = client.GetRoute
	_ = client.VerifyFeed
	_ = client.RequestPermitMessage
	_ = client.RequestPermit
	_ = client.ResolveExecution
	_ = client.PreviewExecution
	_ = client.BuildExecutionTx
	_ = client.GetFillStatus
}
