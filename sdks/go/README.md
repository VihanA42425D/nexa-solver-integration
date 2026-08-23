# Nexa V6 Go SDK

Canonical Go implementation of the frozen Nexa V6 SDK contract.

```go
client := nexav6.NewClient()
routes, err := client.GetRoutes(context.Background(), nil)
```

The module validates signed Feeds before returning routes. Wallet and KMS signing stay with the caller.
