import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { withPreload } from '../src/host/node-options.js';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRELOAD = path.join(root, 'src', 'host', 'preload.cjs');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-trust-preload-'));

after(() => fs.rmSync(workspace, { recursive: true, force: true }));

let sequence = 0;

/** Load the preload against a throwaway state file, with patching disabled. */
function policy(hosts) {
  const file = path.join(workspace, `state-${(sequence += 1)}.json`);
  if (hosts !== null) {
    fs.writeFileSync(file, `${JSON.stringify({ version: 1, hosts }, null, 2)}\n`);
  }
  process.env.DSH_TLS_TRUST_STATE = file;
  process.env.DSH_TLS_TRUST_NO_PATCH = '1';
  delete require.cache[require.resolve(PRELOAD)];
  return require(PRELOAD);
}

test('normalizeHost reduces a pasted URL to the TLS hostname', () => {
  const { normalizeHost } = policy([{ host: 'example.com' }]);
  assert.equal(normalizeHost('https://GATEWAY.example.com:8443/v1/chat?x=1'), 'gateway.example.com');
  assert.equal(normalizeHost('  example.com:443  '), 'example.com');
  assert.equal(normalizeHost(undefined), '');
});

test('only hosts approved with skip-verify are trusted', () => {
  const { isTrusted } = policy([
    { host: 'gateway.example.com', skipVerify: true },
    { host: 'kept.example.com', skipVerify: false }
  ]);
  assert.equal(isTrusted('gateway.example.com'), true);
  assert.equal(isTrusted('https://gateway.example.com/v1/messages'), true);
  assert.equal(isTrusted('kept.example.com'), false);
  assert.equal(isTrusted('unknown.example.com'), false);
});

test('a missing state file trusts nothing', () => {
  const { isTrusted } = policy(null);
  assert.equal(isTrusted('gateway.example.com'), false);
});

test('withPreload preserves existing flags and never duplicates itself', () => {
  const preload = '/opt/dsh/preload.cjs';
  assert.equal(withPreload('', preload), `--require ${preload}`);
  assert.equal(withPreload(undefined, preload), `--require ${preload}`);
  assert.equal(
    withPreload('--max-old-space-size=4096', preload),
    `--max-old-space-size=4096 --require ${preload}`
  );
  const once = withPreload('--max-old-space-size=4096', preload);
  assert.equal(withPreload(once, preload), once);
});

test('withPreload quotes a path that contains spaces', () => {
  assert.equal(
    withPreload('', '/Users/me/My Plugins/preload.cjs'),
    '--require "/Users/me/My Plugins/preload.cjs"'
  );
});
