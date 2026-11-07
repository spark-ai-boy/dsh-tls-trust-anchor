# TLS trust anchor

Adds a **Certificate trust** section to DeepSeek Harness Settings where a host can be marked to skip TLS certificate verification — so a private model gateway behind a self-signed certificate connects instead of failing with `Connection error`.

[中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/dsh-tls-trust-anchor)](https://www.npmjs.com/package/dsh-tls-trust-anchor)[![GitHub stars](https://img.shields.io/github/stars/spark-ai-boy/dsh-tls-trust-anchor?style=social)](https://github.com/spark-ai-boy/dsh-tls-trust-anchor)

## The problem

Node.js verifies TLS with its **own** CA store. It never reads the macOS or Windows system trust store, so a certificate that Safari, Chrome, or a Bun-based CLI accepts can still be rejected inside the Harness runtime:

```
UNABLE_TO_VERIFY_LEAF_SIGNATURE | unable to verify the first certificate
```

A self-signed leaf certificate (`Basic Constraints: CA:FALSE`) cannot act as a trust anchor at all unless OpenSSL is told to accept a partial chain, and Node does not expose that switch through a provider configuration. There is no provider-level certificate or trust option to set.

## What it does

- **Per-host switch** — add `newapi.example.com`, decide whether to skip verification for it, remove it again. The decision applies to that host only.
- **Only that host** — no certificate store edits, no other application affected. Every other connection keeps standard verification: expiry, unknown roots, and hostname mismatches are all still rejected.
- **Child processes too** — while the plugin is active it appends a `--require` preload to `NODE_OPTIONS`, so Node children the Harness spawns (a model gateway proxy that runs on its own, for example) follow the same per-host policy.
- **Persisted** — the list lives in `~/.dsh/tls-trust/trusted-hosts.json` and survives restarts.
- **Live** — the Host patches `tls.connect` for the Harness runtime; the switch takes effect on the next request, without a restart.

## Install

### Requirements

- DeepSeek Harness 0.2.x desktop or web profile, with third-party plugin installation enabled
- The model endpoint you want to trust

### Source

The Harness plugin manager installs from a GitHub repository or an npm package:

- **GitHub repository**: `https://github.com/spark-ai-boy/dsh-tls-trust-anchor`
- **npm package**: `dsh-tls-trust-anchor`

### Steps

1. Open **Settings → Plugins**, install the bundle from the repository or npm.
2. Open **Settings → Models** and add your provider with its `baseURL`, API type, and key. The `baseURL` is the API root, so enter `https://newapi.example.com` — not `https://newapi.example.com/v1`, because the client appends `/v1/messages` itself.
3. Open **Settings → Certificate trust**, type the hostname, and press **Add host**. The switch defaults to on (verification skipped).
4. Return to the chat and select the model.

## Security

Skipping verification keeps the connection **encrypted** but stops proving **who the peer is**. Use it only for a certificate you control, and prefer a properly issued certificate whenever one is available. The trust list is narrow by design: a version check, an expired certificate, or an unknown root on any other host is still refused.

Removing a host from the list immediately restores standard verification for it on the next request.

## How it works

| Half | Behaviour |
|---|---|
| Host (`index.js`) | Reads the persisted list, patches `tls.connect` inside the Harness runtime, and serves the `tlsTrust` Remote service |
| Client (`client.js`) | Registers a `settings.section` row and renders the list, switch, and delete button |
| State (`src/host/state.js`) | Hostname normalisation and JSON persistence |
| Preload (`src/host/preload.cjs`) | Enters child processes through `NODE_OPTIONS=--require`, reads the same list, and patches per host |

Only connections whose `servername`/`host` matches a trusted entry get `rejectUnauthorized: false`. Everything else is passed through untouched.

## Limitations

- The Host half imports `@deepseek-ai/dsh-typert-protocol`, which the Harness installation provides. It is not bundled.
- Remote method parameter names are read from Host source when no generated Typert artifact is present, so the names in `client.js` descriptors must match the Host method signatures verbatim.
- A child process only inherits the policy if it starts **after** the plugin activated; a long-running process that predates it needs one restart.

## Development

```bash
node --test "tests/*.test.js"   # unit tests
npm run check                   # syntax + tests
```

## License

MIT
