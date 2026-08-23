# Nexa V6 .NET SDK

Canonical .NET implementation of the frozen Nexa V6 SDK contract.

```shell
dotnet add package VihanA.Nexa.V6.Sdk --version 1.0.0
```

```csharp
var client = new NexaV6Client();
var routes = await client.GetRoutes();
```

Feed verification is mandatory before routes are returned. Wallet and KMS signing stay with the caller.
