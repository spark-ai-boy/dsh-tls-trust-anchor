import fs from 'node:fs';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

import { withPreload } from './src/host/node-options.js';
import { loadHosts, normalizeHost, saveHosts, toList } from './src/host/state.js';

export const name = 'tls-trust-anchor';

/** Loaded into child Node processes so they honour the same per-host policy. */
const PRELOAD_PATH = fileURLToPath(new URL('./src/host/preload.cjs', import.meta.url));

const NAMESPACE = 'tlsTrust';
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods';

/**
 * Remote surface behind the Settings section. Method signatures are parsed from
 * source when no generated artifact is present, so every parameter name here
 * must match the descriptor declared in `client.js` verbatim.
 */
export class TlsTrustService extends TypertRemoteService {
  constructor(ctx, hosts) {
    super(ctx, NAMESPACE);
    this.hosts = hosts;
  }

  async listHosts() {
    return toList(this.hosts);
  }

  async addHost(host) {
    const normalized = normalizeHost(host);
    if (normalized.length === 0) throw new Error('请输入主机名，例如 newapi.example.com');
    if (!this.hosts.has(normalized)) this.hosts.set(normalized, true);
    saveHosts(this.hosts);
    return toList(this.hosts);
  }

  async removeHost(host) {
    this.hosts.delete(normalizeHost(host));
    saveHosts(this.hosts);
    return toList(this.hosts);
  }

  async setHostSkipVerify(host, value) {
    const normalized = normalizeHost(host);
    if (this.hosts.has(normalized)) {
      this.hosts.set(normalized, value !== false);
      saveHosts(this.hosts);
    }
    return toList(this.hosts);
  }
}

// The Typert Gateway discovers Remote methods from this marker when no generated
// artifact is present. The matching Client descriptors use the same namespace.
Object.defineProperty(TlsTrustService.prototype, REMOTE_METHODS, {
  configurable: true,
  value: {
    version: 1,
    methods: ['listHosts', 'addHost', 'removeHost', 'setHostSkipVerify'].map((method) => ({
      method,
      invocation: { kind: 'direct' }
    }))
  }
});

export function apply(ctx) {
  const hosts = loadHosts();
  const original = tls.connect;

  function patched(...args) {
    const options = args[0];
    if (options !== null && typeof options === 'object') {
      const host = normalizeHost(options.servername ?? options.host ?? '');
      // Connection-scoped: only hosts the user explicitly approved lose
      // verification, every other connection keeps the standard rules.
      if (host.length > 0 && hosts.get(host) === true) {
        args[0] = { ...options, rejectUnauthorized: false };
      }
    }
    return original.apply(this, args);
  }

  ctx.effect(() => {
    tls.connect = patched;
    return () => {
      tls.connect = original;
    };
  }, 'tls-trust-anchor: host verification policy');

  // A separate Node process — a model gateway proxy, for instance — builds its
  // own TLS sockets and never sees the patch above. NODE_OPTIONS is the one
  // channel every Node child of the Harness inherits, so the preload carries
  // the same per-host policy across that boundary.
  const previousNodeOptions = process.env.NODE_OPTIONS;

  ctx.effect(() => {
    if (fs.existsSync(PRELOAD_PATH)) {
      process.env.NODE_OPTIONS = withPreload(previousNodeOptions, PRELOAD_PATH);
    }
    return () => {
      if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousNodeOptions;
    };
  }, 'tls-trust-anchor: child process preload');

  new TlsTrustService(ctx, hosts);
}

export default { name, apply };
