import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Where the trusted-host list lives between runs. */
export const STATE_DIR = path.join(os.homedir(), '.dsh', 'tls-trust');
export const STATE_FILE = path.join(STATE_DIR, 'trusted-hosts.json');

/**
 * Reduce anything a user may paste — a bare host, a URL, or a host with a port
 * and path — to the lower-case hostname that TLS actually reports.
 */
export function normalizeHost(raw) {
  let value = String(raw ?? '').trim().toLowerCase();
  if (value.length === 0) return '';
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split('/')[0];
  value = value.split('?')[0];
  value = value.split('#')[0];
  value = value.replace(/:\d+$/, '');
  value = value.replace(/^\[|\]$/g, '');
  return value;
}

/** Sorted, JSON-safe view handed to the Client. */
export function toList(hosts) {
  return [...hosts.entries()]
    .map(([host, skipVerify]) => ({ host, skipVerify }))
    .sort((left, right) => left.host.localeCompare(right.host));
}

/** Read the persisted list; a missing or damaged file yields an empty map. */
export function loadHosts(file = STATE_FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = Array.isArray(parsed?.hosts) ? parsed.hosts : [];
    const hosts = new Map();
    for (const entry of entries) {
      const host = normalizeHost(entry?.host);
      if (host.length > 0) hosts.set(host, entry?.skipVerify !== false);
    }
    return hosts;
  } catch {
    return new Map();
  }
}

/** Persist the list, creating the directory on first write. */
export function saveHosts(hosts, file = STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const entries = toList(hosts);
  fs.writeFileSync(file, `${JSON.stringify({ version: 1, hosts: entries }, null, 2)}\n`);
}
