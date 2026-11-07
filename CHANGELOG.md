# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-07

### Added

- Child Node processes now inherit the trust policy. While the plugin is active, `NODE_OPTIONS` gains `--require <preload>`, and that preload applies the same per-host `rejectUnauthorized: false` rule inside the child.
- This is what lets a model gateway that runs as its own Node process — billion-context's `bili` daemon, for example — reach an approved host without changing anything on the server.
- `src/host/node-options.js` exports `withPreload`, so a pre-existing `NODE_OPTIONS` survives and the flag is never added twice.

### Notes

- Only hosts listed in `~/.dsh/tls-trust/trusted-hosts.json` with `skipVerify: true` are affected; every other connection keeps the standard verification rules.
- Processes started before the plugin activated keep the environment they already had — restart them to pick up the policy.

## [0.1.0] - 2026-11-07

### Added

- **Certificate trust** Settings section: add a hostname, toggle whether TLS certificate verification is skipped for it, and remove it again.
- Host side patches `tls.connect` inside the Harness runtime and applies `rejectUnauthorized: false` only to hosts the user approved.
- Trusted-host list persisted to `~/.dsh/tls-trust/trusted-hosts.json`.
- `tlsTrust` Remote service with `listHosts`, `addHost`, `removeHost`, and `setHostSkipVerify`.
- Manifest and state unit tests, so the patch row name, module loader id, and Remote package name cannot drift from the package name.

### Notes

- Remote method parameter names are read from Host source when no generated Typert artifact is present; the parameter names in the Client descriptors must therefore match the Host method signatures verbatim.
