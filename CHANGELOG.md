# Changelog

All notable public integration changes are documented here.

This project follows semantic versioning for the published integration package and SDK surfaces where applicable.

## [Unreleased]

### Documentation

- Added a GitHub Pages-ready documentation entry point.
- Added focused quick-start, architecture, integration, and FAQ guides.
- Added contribution and release-note guidance for public repository engagement.

## [6.3.0]

### Added

- Mainnet V6 machine-readable solver discovery.
- Verified Discovery Facade, Registry, Router, ERC-7683 resolver, and OIF discovery identities.
- OpenAPI 3.1 public solver surface.
- Signed Feed verification and execution Permit flow.
- Frozen cross-language SDK contract and deterministic vectors.
- Published SDK implementations for TypeScript/Node, Python, Rust, JVM, and .NET, plus Go source.
- Scanner-grade onchain discovery fingerprint.
- Graph and Substreams indexing package.
- Graph Studio deployments for Base and BNB Smart Chain.
- Published Substreams packages for Base, BNB Smart Chain, and HyperEVM.
- Public crawler discovery entry points including `robots.txt`, `sitemap.xml`, and `llms.txt`.

### Architecture

- External indexers remain non-authoritative.
- No indexer is inserted into the execution authority chain.
- Live route terms remain authorized by the Signed Feed.
- Final execution remains authorized by the Execution Permit.
