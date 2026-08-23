package nexav6

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var permitComponents = []abi.ArgumentMarshaling{
	{Name: "releaseId", Type: "bytes32"}, {Name: "fillId", Type: "bytes32"},
	{Name: "routeId", Type: "bytes32"}, {Name: "quoteId", Type: "bytes32"},
	{Name: "policyHash", Type: "bytes32"}, {Name: "permitNonce", Type: "bytes32"},
	{Name: "sourceNetworkId", Type: "bytes32"}, {Name: "sourceAssetId", Type: "bytes32"},
	{Name: "destinationNetworkId", Type: "bytes32"}, {Name: "destinationAssetId", Type: "bytes32"},
	{Name: "sourceVaultAccountId", Type: "bytes32"}, {Name: "destinationVaultAccountId", Type: "bytes32"},
	{Name: "payerAccountId", Type: "bytes32"}, {Name: "recipientAccountId", Type: "bytes32"},
	{Name: "dataVersion", Type: "uint64"}, {Name: "executionGeneration", Type: "bytes32"},
	{Name: "validAfter", Type: "uint64"}, {Name: "validUntil", Type: "uint64"},
	{Name: "sourceFinalityBlocks", Type: "uint32"}, {Name: "settlementWindowSeconds", Type: "uint32"},
	{Name: "sourceChainId", Type: "uint256"}, {Name: "destinationChainId", Type: "uint256"},
	{Name: "sourceAsset", Type: "address"}, {Name: "destinationAsset", Type: "address"},
	{Name: "sourceVault", Type: "address"}, {Name: "destinationVault", Type: "address"},
	{Name: "sourceRouter", Type: "address"}, {Name: "payer", Type: "address"},
	{Name: "recipient", Type: "address"}, {Name: "amountInRaw", Type: "uint128"},
	{Name: "amountOutRaw", Type: "uint128"},
}

const permitTupleSignature = "(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes32,uint64,uint64,uint32,uint32,uint256,uint256,address,address,address,address,address,address,address,uint128,uint128)"

type executionPermit struct {
	ReleaseId                 [32]byte
	FillId                    [32]byte
	RouteId                   [32]byte
	QuoteId                   [32]byte
	PolicyHash                [32]byte
	PermitNonce               [32]byte
	SourceNetworkId           [32]byte
	SourceAssetId             [32]byte
	DestinationNetworkId      [32]byte
	DestinationAssetId        [32]byte
	SourceVaultAccountId      [32]byte
	DestinationVaultAccountId [32]byte
	PayerAccountId            [32]byte
	RecipientAccountId        [32]byte
	DataVersion               uint64
	ExecutionGeneration       [32]byte
	ValidAfter                uint64
	ValidUntil                uint64
	SourceFinalityBlocks      uint32
	SettlementWindowSeconds   uint32
	SourceChainId             *big.Int
	DestinationChainId        *big.Int
	SourceAsset               common.Address
	DestinationAsset          common.Address
	SourceVault               common.Address
	DestinationVault          common.Address
	SourceRouter              common.Address
	Payer                     common.Address
	Recipient                 common.Address
	AmountInRaw               *big.Int
	AmountOutRaw              *big.Int
}

func uintValue(row map[string]any, key string, bits int) (uint64, error) {
	value := bigValue(row, key)
	if value.Sign() < 0 || value.BitLen() > bits {
		return 0, &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	return value.Uint64(), nil
}

func permitValue(row map[string]any) (executionPermit, error) {
	dataVersion, err := uintValue(row, "dataVersion", 64)
	if err != nil {
		return executionPermit{}, err
	}
	validAfter, err := uintValue(row, "validAfter", 64)
	if err != nil {
		return executionPermit{}, err
	}
	validUntil, err := uintValue(row, "validUntil", 64)
	if err != nil {
		return executionPermit{}, err
	}
	finality, err := uintValue(row, "sourceFinalityBlocks", 32)
	if err != nil {
		return executionPermit{}, err
	}
	window, err := uintValue(row, "settlementWindowSeconds", 32)
	if err != nil {
		return executionPermit{}, err
	}
	return executionPermit{
		ReleaseId: hashValue(row, "releaseId"), FillId: hashValue(row, "fillId"),
		RouteId: hashValue(row, "routeId"), QuoteId: hashValue(row, "quoteId"),
		PolicyHash: hashValue(row, "policyHash"), PermitNonce: hashValue(row, "permitNonce"),
		SourceNetworkId: hashValue(row, "sourceNetworkId"), SourceAssetId: hashValue(row, "sourceAssetId"),
		DestinationNetworkId: hashValue(row, "destinationNetworkId"), DestinationAssetId: hashValue(row, "destinationAssetId"),
		SourceVaultAccountId: hashValue(row, "sourceVaultAccountId"), DestinationVaultAccountId: hashValue(row, "destinationVaultAccountId"),
		PayerAccountId: hashValue(row, "payerAccountId"), RecipientAccountId: hashValue(row, "recipientAccountId"),
		DataVersion: dataVersion, ExecutionGeneration: hashValue(row, "executionGeneration"),
		ValidAfter: validAfter, ValidUntil: validUntil, SourceFinalityBlocks: uint32(finality),
		SettlementWindowSeconds: uint32(window), SourceChainId: bigValue(row, "sourceChainId"),
		DestinationChainId: bigValue(row, "destinationChainId"), SourceAsset: addressValue(row, "sourceAsset"),
		DestinationAsset: addressValue(row, "destinationAsset"), SourceVault: addressValue(row, "sourceVault"),
		DestinationVault: addressValue(row, "destinationVault"), SourceRouter: addressValue(row, "sourceRouter"),
		Payer: addressValue(row, "payer"), Recipient: addressValue(row, "recipient"),
		AmountInRaw: bigValue(row, "amountInRaw"), AmountOutRaw: bigValue(row, "amountOutRaw"),
	}, nil
}

func permitParts(envelope map[string]any) (map[string]any, map[string]any, []byte, error) {
	row := envelope
	if outer, ok := asMap(envelope["permit"]); ok {
		if _, nested := asMap(outer["permit"]); nested {
			row = outer
		}
	}
	permit, ok := asMap(row["permit"])
	if !ok {
		return nil, nil, nil, &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	signature, err := signatureBytes(row["permitSignature"])
	if err != nil {
		return nil, nil, nil, err
	}
	return row, permit, signature, nil
}

func encodePermitCall(method string, permit map[string]any, signature []byte) (string, error) {
	tupleType, err := abi.NewType("tuple", "", permitComponents)
	if err != nil {
		return "", err
	}
	bytesType, _ := abi.NewType("bytes", "", nil)
	args := abi.Arguments{{Type: tupleType}, {Type: bytesType}}
	value, err := permitValue(permit)
	if err != nil {
		return "", err
	}
	packed, err := args.Pack(value, signature)
	if err != nil {
		return "", &SDKError{Code: "NEXA_SDK_ABI_ERROR", Details: err.Error()}
	}
	selector := crypto.Keccak256([]byte(method + "(" + permitTupleSignature + ",bytes)"))[:4]
	return "0x" + hex.EncodeToString(append(selector, packed...)), nil
}

func BuildExecutionTx(envelope map[string]any) (ExecutionTx, error) {
	row, permit, signature, err := permitParts(envelope)
	if err != nil {
		return ExecutionTx{}, err
	}
	data, err := encodePermitCall("fillDirect", permit, signature)
	if err != nil {
		return ExecutionTx{}, err
	}
	target := fmt.Sprint(permit["sourceRouter"])
	if execution, ok := asMap(row["execution"]); ok && common.IsHexAddress(fmt.Sprint(execution["target"])) {
		target = fmt.Sprint(execution["target"])
	}
	value := "0"
	if addressValue(permit, "sourceAsset") == (common.Address{}) {
		value = fmt.Sprint(permit["amountInRaw"])
	}
	return ExecutionTx{
		ChainID: bigValue(permit, "sourceChainId").Uint64(),
		From:    addressValue(permit, "payer").Hex(), To: common.HexToAddress(target).Hex(),
		Data: data, Value: value,
	}, nil
}

func encodeResolveExecution(payload string) (string, error) {
	raw, err := hex.DecodeString(strings.TrimPrefix(payload, "0x"))
	if err != nil {
		return "", &SDKError{Code: "NEXA_SDK_ABI_ERROR"}
	}
	bytesType, _ := abi.NewType("bytes", "", nil)
	packed, err := (abi.Arguments{{Type: bytesType}}).Pack(raw)
	if err != nil {
		return "", err
	}
	selector := crypto.Keccak256([]byte("resolveExecution(bytes)"))[:4]
	return "0x" + hex.EncodeToString(append(selector, packed...)), nil
}
