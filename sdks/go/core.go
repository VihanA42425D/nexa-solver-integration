// Package nexav6 is the canonical Go client for the Nexa V6 public solver API.
package nexav6

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	FeedDomain          = "NEXA_MAINNET_V6_SIGNED_FEED_V1"
	PermitRequestDomain = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1"
	DefaultBaseURL      = "https://solver.vsnexa.com"
	DefaultDiscoveryURI = "https://solver.vsnexa.com/.well-known/nexa-solver.json"
	DefaultResolver     = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522"
)

type SDKError struct {
	Code       string
	ServerCode string
	Details    any
}

func (e *SDKError) Error() string { return e.Code }

type FeedVerification struct {
	Valid           bool
	ComputedHash    string
	ExpectedHash    string
	RecoveredSigner string
	DeclaredSigner  string
	ExpectedSigner  string
	Expired         bool
}

func normalizedJSON(value any) (any, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var result any
	if err := decoder.Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func jsonString(value string) (string, error) {
	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(output.String(), "\n"), nil
}

func canonical(value any) (string, error) {
	switch row := value.(type) {
	case nil:
		return "null", nil
	case bool:
		if row {
			return "true", nil
		}
		return "false", nil
	case string:
		return jsonString(row)
	case json.Number:
		return row.String(), nil
	case float64:
		return strconv.FormatFloat(row, 'f', -1, 64), nil
	case []any:
		parts := make([]string, len(row))
		for index, item := range row {
			encoded, err := canonical(item)
			if err != nil {
				return "", err
			}
			parts[index] = encoded
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(row))
		for key := range row {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := make([]string, len(keys))
		for index, key := range keys {
			keyJSON, err := jsonString(key)
			if err != nil {
				return "", err
			}
			valueJSON, err := canonical(row[key])
			if err != nil {
				return "", err
			}
			parts[index] = keyJSON + ":" + valueJSON
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		normalized, err := normalizedJSON(value)
		if err != nil {
			return "", err
		}
		return canonical(normalized)
	}
}

func CanonicalJSON(value any) (string, error) { return canonical(value) }

func ComputeFeedHash(payload any) (string, error) {
	encoded, err := CanonicalJSON(payload)
	if err != nil {
		return "", err
	}
	return crypto.Keccak256Hash([]byte(FeedDomain + "\n" + encoded)).Hex(), nil
}

func asMap(value any) (map[string]any, bool) {
	row, ok := value.(map[string]any)
	return row, ok
}

func stringValue(row map[string]any, key string) string {
	value, _ := row[key].(string)
	return value
}

func address(value string) string {
	if !common.IsHexAddress(value) {
		return ""
	}
	return common.HexToAddress(value).Hex()
}

func VerifyFeed(feed map[string]any, expectedSigner string, nowSeconds int64, required bool) (FeedVerification, error) {
	payload, ok := asMap(feed["signedPayload"])
	if !ok {
		payload, ok = asMap(feed["payload"])
	}
	if !ok {
		payload = feed
	}
	routes, routesOK := payload["routes"].([]any)
	_ = routes
	if stringValue(payload, "schema") != FeedDomain || !routesOK {
		return FeedVerification{}, &SDKError{Code: "NEXA_SDK_FEED_INVALID"}
	}
	computed, err := ComputeFeedHash(payload)
	if err != nil {
		return FeedVerification{}, &SDKError{Code: "NEXA_SDK_FEED_INVALID", Details: err.Error()}
	}
	expectedHash := strings.ToLower(stringValue(feed, "feedHash"))
	declared := address(stringValue(feed, "feedSigner"))
	expected := address(expectedSigner)
	if expected == "" {
		expected = declared
	}
	recovered := ""
	signature := common.FromHex(stringValue(feed, "feedSignature"))
	if len(signature) == 65 {
		if signature[64] >= 27 {
			signature[64] -= 27
		}
		if key, recoverErr := crypto.SigToPub(common.FromHex(computed), signature); recoverErr == nil {
			recovered = crypto.PubkeyToAddress(*key).Hex()
		}
	}
	if nowSeconds == 0 {
		nowSeconds = time.Now().Unix()
	}
	generatedAt, _ := strconv.ParseInt(fmt.Sprint(payload["generatedAt"]), 10, 64)
	validUntil, _ := strconv.ParseInt(fmt.Sprint(payload["validUntil"]), 10, 64)
	expired := validUntil <= nowSeconds
	result := FeedVerification{
		Valid: strings.EqualFold(computed, expectedHash) && recovered != "" && declared != "" &&
			expected != "" && strings.EqualFold(recovered, declared) && strings.EqualFold(declared, expected) &&
			generatedAt <= nowSeconds && !expired,
		ComputedHash: strings.ToLower(computed), ExpectedHash: expectedHash,
		RecoveredSigner: recovered, DeclaredSigner: declared, ExpectedSigner: expected, Expired: expired,
	}
	if required && !result.Valid {
		code := "NEXA_SDK_FEED_SIGNER_MISMATCH"
		if !strings.EqualFold(computed, expectedHash) {
			code = "NEXA_SDK_FEED_HASH_MISMATCH"
		}
		if expired {
			code = "NEXA_SDK_FEED_EXPIRED"
		}
		return result, &SDKError{Code: code, Details: result}
	}
	return result, nil
}

func bytes32(value any) (string, error) {
	result := strings.ToLower(fmt.Sprint(value))
	raw, err := hex.DecodeString(strings.TrimPrefix(result, "0x"))
	if err != nil || len(raw) != 32 {
		return "", &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
	}
	return "0x" + hex.EncodeToString(raw), nil
}

func canonicalLocator(value any) (map[string]any, error) {
	if text, ok := value.(string); ok {
		return map[string]any{"native": text}, nil
	}
	if row, ok := value.(map[string]any); ok {
		return row, nil
	}
	return nil, &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
}

func RequestPermitMessage(input map[string]any) (string, error) {
	quoteID, err := bytes32(input["quoteId"])
	if err != nil {
		return "", err
	}
	amount, ok := new(big.Int).SetString(fmt.Sprint(input["requestedAmountInRaw"]), 10)
	if !ok || amount.Sign() <= 0 || amount.BitLen() > 128 {
		return "", &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
	}
	standard := strings.ToUpper(fmt.Sprint(input["standard"]))
	if standard == "" || standard == "<nil>" {
		standard = "DIRECT"
	}
	idempotency := strings.TrimSpace(fmt.Sprint(input["idempotencyKey"]))
	if len(idempotency) < 8 || len(idempotency) > 128 {
		return "", &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
	}
	lines := []string{PermitRequestDomain, "quoteId=" + quoteID, "requestedAmountInRaw=" + amount.String(), "standard=" + standard}
	payer := address(fmt.Sprint(input["payer"]))
	if payer != "" {
		lines = append(lines, "payer="+strings.ToLower(payer))
	} else {
		accountID, accountErr := bytes32(input["payerAccountId"])
		locator, locatorErr := canonicalLocator(input["payerLocator"])
		if accountErr != nil || locatorErr != nil {
			return "", &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
		}
		encoded, _ := CanonicalJSON(locator)
		lines = append(lines, "payerAccountId="+accountID+"\npayerLocator="+encoded)
	}
	recipient := address(fmt.Sprint(input["recipient"]))
	if recipient != "" {
		lines = append(lines, "recipient="+strings.ToLower(recipient))
	} else {
		accountID, accountErr := bytes32(input["recipientAccountId"])
		locator, locatorErr := canonicalLocator(input["recipientLocator"])
		if accountErr != nil || locatorErr != nil {
			return "", &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
		}
		encoded, _ := CanonicalJSON(locator)
		lines = append(lines, "recipientAccountId="+accountID+"\nrecipientLocator="+encoded)
	}
	return strings.Join(append(lines, "idempotencyKey="+idempotency), "\n"), nil
}

func requireMap(value any) (map[string]any, error) {
	row, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("not an object")
	}
	return row, nil
}

func signatureBytes(value any) ([]byte, error) {
	raw, err := hex.DecodeString(strings.TrimPrefix(fmt.Sprint(value), "0x"))
	if err != nil || len(raw) != 65 {
		return nil, &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	return raw, nil
}

func bigValue(row map[string]any, key string) *big.Int {
	value, _ := new(big.Int).SetString(fmt.Sprint(row[key]), 10)
	if value == nil {
		return new(big.Int)
	}
	return value
}

func hashValue(row map[string]any, key string) [32]byte {
	return common.HexToHash(fmt.Sprint(row[key]))
}

func addressValue(row map[string]any, key string) common.Address {
	return common.HexToAddress(fmt.Sprint(row[key]))
}

type ExecutionTx struct {
	ChainID uint64
	From    string
	To      string
	Data    string
	Value   string
}
