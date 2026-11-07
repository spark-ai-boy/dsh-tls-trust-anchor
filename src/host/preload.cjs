/**
 * Child-process half of the trust policy.
 *
 * The Host plugin reaches only the Harness process: it patches that process's
 * own `tls.connect`. A model gateway that runs as a separate Node process —
 * billion-context's `bili` daemon, for example — builds its own TLS sockets and
 * never sees that patch.
 *
 * The Host plugin therefore appends `--require <this file>` to `NODE_OPTIONS`,
 * which every Node child of the Harness inherits. Inside the child, this file
 * applies exactly the same per-host rule the Harness applies to itself, reading
 * the same `trusted-hosts.json`.
 *
 * It is deliberately paranoid: any failure leaves the process untouched, and a
 * host that was never approved keeps the standard verification rules.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_FILE =
  process.env.DSH_TLS_TRUST_STATE ||
  path.join(os.homedir(), '.dsh', 'tls-trust', 'trusted-hosts.json');

/** Re-stat at most this often, so a toggle in Settings is honoured quickly. */
const CACHE_TTL_MS = 1000;

let cache = new Map();
let cachedAt = 0;
let cachedMtime = -1;

/**
 * Reduce anything a user may paste — a bare host, a URL, or a host with a port
 * and path — to the lower-case hostname TLS actually reports.
 */
function normalizeHost(raw) {
  let value = String(raw == null ? '' : raw).trim().toLowerCase();
  if (value.length === 0) return '';
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split('/')[0];
  value = value.split('?')[0];
  value = value.split('#')[0];
  value = value.replace(/:\d+$/, '');
  return value.replace(/^\[|\]$/g, '');
}

function readHosts() {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cache;
  cachedAt = now;

  try {
    const stat = fs.statSync(STATE_FILE);
    if (stat.mtimeMs === cachedMtime) return cache;

    cachedMtime = stat.mtimeMs;
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const entries = Array.isArray(parsed && parsed.hosts) ? parsed.hosts : [];
    const next = new Map();
    for (const entry of entries) {
      const host = normalizeHost(entry && entry.host);
      if (host.length > 0) next.set(host, (entry && entry.skipVerify) !== false);
    }
    cache = next;
  } catch {
    cache = new Map();
    cachedMtime = -1;
  }

  return cache;
}

/** Whether `host` was approved in Settings with verification skipped. */
function isTrusted(host) {
  const normalized = normalizeHost(host);
  return normalized.length > 0 && readHosts().get(normalized) === true;
}

module.exports = { isTrusted, normalizeHost, STATE_FILE };

// Tests load this module with the patch disabled to exercise the policy alone.
if (process.env.DSH_TLS_TRUST_NO_PATCH !== '1') {
  const tls = require('node:tls');
  const original = tls.connect;

  tls.connect = function patchedConnect(...args) {
    try {
      const options = args[0];
      if (options !== null && typeof options === 'object') {
        const host = normalizeHost(options.servername || options.host || '');
        // Connection-scoped: only approved hosts lose verification.
        if (host.length > 0 && isTrusted(host)) {
          args[0] = Object.assign({}, options, { rejectUnauthorized: false });
        }
      }
    } catch {
      // A broken policy must never break an unrelated connection.
    }
    return original.apply(this, args);
  };
}
