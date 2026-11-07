import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('manifest declares a bundle patch and a client entry', () => {
  assert.equal(manifest.type, 'module');
  assert.ok(manifest.dsh?.bundle?.patch, 'dsh.bundle.patch is required');
  assert.ok(fs.existsSync(path.join(root, manifest.dsh.bundle.patch)), 'the declared patch file must exist');
  assert.equal(manifest.dsh?.client?.platform, 'web');
  assert.ok(manifest.exports['./client'], './client must be exported');
});

test('the patch row names this package', () => {
  const patch = fs.readFileSync(path.join(root, manifest.dsh.bundle.patch), 'utf8');
  assert.ok(
    patch.includes(`name: '${manifest.name}'`),
    `the inserted row must be named ${manifest.name}`
  );
});

test('the client module id and remote package match the package name', () => {
  const client = fs.readFileSync(path.join(root, manifest.exports['./client']), 'utf8');
  assert.ok(client.includes(`id: "${manifest.name}"`), 'the module loader id must equal the package name');
  assert.ok(client.includes(`package: "${manifest.name}"`), 'the Remote contribution package must equal the package name');
});

test('every explicitly listed file exists', () => {
  for (const entry of manifest.files) {
    if (entry.includes('*')) continue;
    assert.ok(fs.existsSync(path.join(root, entry)), `${entry} is listed in files but missing`);
  }
});
