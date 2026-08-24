# Contributing

Thanks for improving the public Nexa V6 integration surface.

## Good contributions

Public contributions should focus on:

- solver onboarding and interoperability
- SDK correctness and conformance
- public discovery / OpenAPI quality
- ERC-7683 compatibility
- OIF discovery metadata
- passive indexing packages
- examples and documentation
- deterministic verification tooling

## Before opening a change

Run the relevant repository checks:

```bash
npm run validate
npm test
npm run sdk:conformance
npm run package:verify
```

If indexing files are affected, also run:

```bash
npm run indexing:check
```

## Design constraints

Do not propose changes that:

- make a passive indexer authoritative for execution
- replace Signed Feed verification
- bypass the Execution Permit
- add duplicate raw-chain decoding when a canonical projection already exists
- introduce secrets into examples or repository files
- expose private operational infrastructure

## Integration questions

Use the existing solver-operator onboarding issue form for concrete onboarding requests. For implementation questions, include:

- target network
- integration type (solver, wallet, aggregator, scanner, indexer, SDK)
- exact public endpoint or artifact involved
- reproducible error/output

## Security

Do not open a public issue for a sensitive vulnerability. Follow [SECURITY.md](SECURITY.md).
