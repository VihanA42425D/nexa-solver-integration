package nexav6

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

type Client struct {
	BaseURL            string
	DiscoveryURI       string
	ExpectedFeedSigner string
	HTTP               *http.Client
}

type RoutesResult struct {
	Feed         map[string]any
	Routes       []any
	Verification FeedVerification
}

type ResolvedExecution struct {
	RouteId  [32]byte
	QuoteId  [32]byte
	Target   common.Address
	Value    *big.Int
	CallData []byte
}

type ResolutionResult struct {
	Resolver      string
	RouteID       string
	QuoteID       string
	Target        string
	Value         string
	CallData      string
	RawReturnData string
}

type PreviewResult struct {
	Valid         bool
	Reason        string
	RawReturnData string
}

func NewClient() *Client {
	return &Client{
		BaseURL: DefaultBaseURL, DiscoveryURI: DefaultDiscoveryURI,
		HTTP: &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		}},
	}
}

func (client *Client) httpClient() *http.Client {
	if client.HTTP == nil {
		client.HTTP = NewClient().HTTP
	}
	return client.HTTP
}

func decodeJSON(reader io.Reader) (map[string]any, error) {
	decoder := json.NewDecoder(reader)
	decoder.UseNumber()
	var result map[string]any
	if err := decoder.Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (client *Client) request(ctx context.Context, method string, endpoint string, body any, headers map[string]string) (map[string]any, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, &SDKError{Code: "NEXA_SDK_HTTP_ERROR", Details: err.Error()}
		}
		reader = bytes.NewReader(raw)
	}
	request, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, &SDKError{Code: "NEXA_SDK_HTTP_ERROR", Details: err.Error()}
	}
	request.Header.Set("accept", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := client.httpClient().Do(request)
	if err != nil {
		return nil, &SDKError{Code: "NEXA_SDK_HTTP_ERROR", Details: err.Error()}
	}
	defer response.Body.Close()
	decoded, decodeErr := decodeJSON(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		serverCode := ""
		if decoded != nil {
			serverCode = stringValue(decoded, "error")
		}
		return nil, &SDKError{Code: "NEXA_SDK_HTTP_ERROR", ServerCode: serverCode, Details: response.StatusCode}
	}
	if decodeErr != nil {
		return nil, &SDKError{Code: "NEXA_SDK_HTTP_ERROR", Details: decodeErr.Error()}
	}
	return decoded, nil
}

func (client *Client) Discover(ctx context.Context) (map[string]any, error) {
	endpoint := client.DiscoveryURI
	if endpoint == "" {
		endpoint = DefaultDiscoveryURI
	}
	discovery, err := client.request(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	endpoints, endpointsOK := asMap(discovery["endpoints"])
	releaseID, releaseErr := bytes32(discovery["releaseId"])
	_ = releaseID
	if stringValue(discovery, "schema") != "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2" ||
		fmt.Sprint(discovery["deploymentVersion"]) != "6" || stringValue(discovery, "deploymentStatus") != "ACTIVE" ||
		releaseErr != nil || address(stringValue(discovery, "feedSigner")) == "" ||
		!endpointsOK || stringValue(endpoints, "solverFeed") == "" {
		return nil, &SDKError{Code: "NEXA_SDK_DISCOVERY_INVALID"}
	}
	return discovery, nil
}

func (client *Client) GetRoutes(ctx context.Context, query map[string]any) (RoutesResult, error) {
	discovery, err := client.Discover(ctx)
	if err != nil {
		return RoutesResult{}, err
	}
	endpoints, _ := asMap(discovery["endpoints"])
	parsed, err := url.Parse(stringValue(endpoints, "solverFeed"))
	if err != nil {
		return RoutesResult{}, &SDKError{Code: "NEXA_SDK_DISCOVERY_INVALID"}
	}
	params := parsed.Query()
	if value, ok := query["sourceChainId"]; ok {
		params.Set("sourceChainId", fmt.Sprint(value))
	}
	if value, ok := query["sourceNetworkId"]; ok {
		networkID, networkErr := bytes32(value)
		if networkErr != nil {
			return RoutesResult{}, networkErr
		}
		params.Set("sourceNetworkId", networkID)
	}
	parsed.RawQuery = params.Encode()
	body, err := client.request(ctx, http.MethodGet, parsed.String(), nil, nil)
	if err != nil {
		return RoutesResult{}, err
	}
	feed := body
	if nested, ok := asMap(body["feed"]); ok {
		feed = nested
	}
	expected := client.ExpectedFeedSigner
	if expected == "" {
		expected = stringValue(discovery, "feedSigner")
	}
	verification, err := VerifyFeed(feed, expected, 0, true)
	if err != nil {
		return RoutesResult{}, err
	}
	payload, ok := asMap(feed["signedPayload"])
	if !ok {
		payload = feed
	}
	routes, _ := payload["routes"].([]any)
	return RoutesResult{Feed: feed, Routes: routes, Verification: verification}, nil
}

func (client *Client) GetRoute(ctx context.Context, routeID string) (map[string]any, error) {
	normalized, err := bytes32(routeID)
	if err != nil {
		return nil, err
	}
	discovery, err := client.Discover(ctx)
	if err != nil {
		return nil, err
	}
	endpoints, _ := asMap(discovery["endpoints"])
	endpoint := strings.ReplaceAll(stringValue(endpoints, "routeDetailTemplate"), "{routeId}", normalized)
	body, err := client.request(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	if route, ok := asMap(body["route"]); ok {
		return route, nil
	}
	return body, nil
}

func (client *Client) VerifyFeed(feed map[string]any, expectedSigner string, nowSeconds int64, required bool) (FeedVerification, error) {
	if expectedSigner == "" {
		expectedSigner = client.ExpectedFeedSigner
	}
	return VerifyFeed(feed, expectedSigner, nowSeconds, required)
}

func (client *Client) RequestPermitMessage(input map[string]any) (string, error) {
	return RequestPermitMessage(input)
}

func (client *Client) RequestPermit(ctx context.Context, input map[string]any, requestSignature string) (map[string]any, error) {
	if _, err := signatureBytes(requestSignature); err != nil {
		return nil, &SDKError{Code: "NEXA_SDK_PERMIT_REQUEST_INVALID"}
	}
	if _, err := RequestPermitMessage(input); err != nil {
		return nil, err
	}
	discovery, err := client.Discover(ctx)
	if err != nil {
		return nil, err
	}
	endpoints, _ := asMap(discovery["endpoints"])
	payload := make(map[string]any, len(input)+1)
	for key, value := range input {
		payload[key] = value
	}
	payload["requestSignature"] = requestSignature
	return client.request(ctx, http.MethodPost, stringValue(endpoints, "executionPermits"), payload, map[string]string{
		"content-type": "application/json", "idempotency-key": fmt.Sprint(input["idempotencyKey"]),
	})
}

func (client *Client) rpc(ctx context.Context, rpcURL string, method string, params []any) (string, error) {
	body, err := client.request(ctx, http.MethodPost, rpcURL, map[string]any{
		"jsonrpc": "2.0", "id": 1, "method": method, "params": params,
	}, map[string]string{"content-type": "application/json"})
	if err != nil {
		return "", err
	}
	if rpcError, ok := body["error"]; ok {
		return "", &SDKError{Code: "NEXA_SDK_RPC_ERROR", Details: rpcError}
	}
	result, ok := body["result"].(string)
	if !ok {
		return "", &SDKError{Code: "NEXA_SDK_RPC_ERROR", Details: body}
	}
	return result, nil
}

func (client *Client) ResolveExecution(ctx context.Context, rpcURL string, payload string) (ResolutionResult, error) {
	data, err := encodeResolveExecution(payload)
	if err != nil {
		return ResolutionResult{}, err
	}
	raw, err := client.rpc(ctx, rpcURL, "eth_call", []any{map[string]any{"to": DefaultResolver, "data": data}, "latest"})
	if err != nil {
		return ResolutionResult{}, err
	}
	hashType, _ := abi.NewType("bytes32", "", nil)
	addressType, _ := abi.NewType("address", "", nil)
	uintType, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)
	values, err := (abi.Arguments{{Type: hashType}, {Type: hashType}, {Type: addressType}, {Type: uintType}, {Type: bytesType}}).Unpack(common.FromHex(raw))
	if err != nil || len(values) != 5 {
		return ResolutionResult{}, &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	routeID := values[0].([32]byte)
	quoteID := values[1].([32]byte)
	return ResolutionResult{
		Resolver: DefaultResolver, RouteID: common.BytesToHash(routeID[:]).Hex(),
		QuoteID: common.BytesToHash(quoteID[:]).Hex(), Target: values[2].(common.Address).Hex(),
		Value: values[3].(*big.Int).String(), CallData: "0x" + hex.EncodeToString(values[4].([]byte)), RawReturnData: raw,
	}, nil
}

func (client *Client) PreviewExecution(ctx context.Context, rpcURL string, envelope map[string]any) (PreviewResult, error) {
	_, permit, signature, err := permitParts(envelope)
	if err != nil {
		return PreviewResult{}, err
	}
	data, err := encodePermitCall("previewFillDirect", permit, signature)
	if err != nil {
		return PreviewResult{}, err
	}
	raw, err := client.rpc(ctx, rpcURL, "eth_call", []any{map[string]any{
		"to": fmt.Sprint(permit["sourceRouter"]), "from": fmt.Sprint(permit["payer"]), "data": data,
	}, "latest"})
	if err != nil {
		return PreviewResult{}, err
	}
	boolType, _ := abi.NewType("bool", "", nil)
	hashType, _ := abi.NewType("bytes32", "", nil)
	values, err := (abi.Arguments{{Type: boolType}, {Type: hashType}}).Unpack(common.FromHex(raw))
	if err != nil || len(values) != 2 {
		return PreviewResult{}, &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	reason := values[1].([32]byte)
	return PreviewResult{Valid: values[0].(bool), Reason: common.BytesToHash(reason[:]).Hex(), RawReturnData: raw}, nil
}

func (client *Client) BuildExecutionTx(envelope map[string]any) (ExecutionTx, error) {
	return BuildExecutionTx(envelope)
}

func (client *Client) GetFillStatus(ctx context.Context, fillID string) (map[string]any, error) {
	normalized, err := bytes32(fillID)
	if err != nil {
		return nil, err
	}
	discovery, err := client.Discover(ctx)
	if err != nil {
		return nil, err
	}
	endpoints, _ := asMap(discovery["endpoints"])
	endpoint := strings.ReplaceAll(stringValue(endpoints, "permitStatusTemplate"), "{fillId}", normalized)
	body, err := client.request(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	if permit, ok := asMap(body["permit"]); ok {
		return permit, nil
	}
	return body, nil
}
