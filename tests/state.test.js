import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { loadHosts, normalizeHost, saveHosts, toList } from '../src/host/state.js';

test('normalizeHost reduces URLs, ports and case to a hostname', () => {
  assert.equal(normalizeHost('gateway.example.com'), 'gateway.example.com');
  assert.equal(normalizeHost('  gateway.example.com  '), 'gateway.example.com');
  assert.equal(normalizeHost('https://gateway.example.com'), 'gateway.example.com');
  assert.equal(normalizeHost('https://gateway.example.com/v1'), 'gateway.example.com');
  assert.equal(normalizeHost('http://gateway.example.com:8080/v1/models?x=1'), 'gateway.example.com');
});

test('normalizeHost returns an empty string for missing input', () => {
  assert.equal(normalizeHost(''), '');
  assert.equal(normalizeHost('   '), '');
  assert.equal(normalizeHost(null), '');
  assert.equal(normalizeHost(undefined), '');
});

test('toList sorts hosts and keeps the verification flag', () => {
  const hosts = new Map([
    ['b.example', false],
    ['a.example', true]
  ]);
  assert.deepEqual(toList(hosts), [
    { host: 'a.example', skipVerify: true },
    { host: 'b.example', skipVerify: false }
  ]);
});

test('saveHosts and loadHosts round-trip through a file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-trust-'));
  const file = path.join(dir, 'trusted-hosts.json');
  const hosts = new Map([
    ['gateway.example.com', true],
    ['other.example', false]
  ]);
  saveHosts(hosts, file);
  assert.deepEqual(toList(loadHosts(file)), toList(hosts));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadHosts tolerates a missing or damaged file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-trust-'));
  assert.equal(loadHosts(path.join(dir, 'missing.json')).size, 0);
  const broken = path.join(dir, 'broken.json');
  fs.writeFileSync(broken, 'not json');
  assert.equal(loadHosts(broken).size, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadHosts normalizes stored entries and defaults a missing flag to trusted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-trust-'));
  const file = path.join(dir, 'trusted-hosts.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      hosts: [{ host: 'HTTPS://gateway.example.com:443/v1' }, { host: 'other.example', skipVerify: false }]
    })
  );
  const loaded = loadHosts(file);
  assert.equal(loaded.get('gateway.example.com'), true);
  assert.equal(loaded.get('other.example'), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
