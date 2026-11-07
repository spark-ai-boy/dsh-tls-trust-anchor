# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-07

### Added

- **Certificate trust** Settings section: add a hostname, toggle whether TLS certificate verification is skipped for it, and remove it again.
- Host side patches `tls.connect` inside the Harness runtime and applies `rejectUnauthorized: false` only to hosts the user approved.
- Trusted-host list persisted to `~/.dsh/tls-trust/trusted-hosts.json`.
- `tlsTrust` Remote service with `listHosts`, `addHost`, `removeHost`, and `setHostSkipVerify`.
- Manifest and state unit tests, so the patch row name, module loader id, and Remote package name cannot drift from the package name.

### Notes

- Remote method parameter names are read from Host source when no generated Typert artifact is present; the parameter names in the Client descriptors must therefore match the Host method signatures verbatim.
