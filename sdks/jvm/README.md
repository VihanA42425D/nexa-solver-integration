# Nexa V6 JVM SDK

Canonical Java/Kotlin-compatible SDK for the frozen Nexa V6 contract.

```java
var client = new NexaV6Client();
var routes = client.getRoutes(Map.of());
```

Feed verification is mandatory before routes are returned. Wallet and KMS signing stay with the caller.
