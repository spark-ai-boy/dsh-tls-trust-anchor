# Contributing

## Development

The package has no build step: `index.js`, `client.js`, and `src/host/*.js` are the shipped sources.

```bash
node --test "tests/*.test.js"   # unit tests
npm run check                   # syntax check + tests
```

## Installing a local checkout

Write the bundle in the workspace, then install it through the Harness plugin manager with the absolute package directory as the target. Do not hand-edit the profile's `package.json` or `cordis.patch.yml`; the plugin manager owns those files.

Two install shapes behave differently:

- **Directory (`link:`)**: live edits, but the package resolves from its real path, so `@deepseek-ai/*` imports in the Host half fail with `ERR_MODULE_NOT_FOUND`.
- **Packed tarball (`npm pack`)**: extracted into the profile's `node_modules`, so those imports resolve the same way they do for other installed bundles. Use this when the Host half imports Harness packages.

Replacing an installed package needs a Harness restart to load a fresh JavaScript module generation.

## Releasing

Publishing uses npm **Trusted Publishing**: the workflow trades a GitHub OIDC
token for a short-lived credential, so the repository stores no `NPM_TOKEN`
secret.

One-time setup on npmjs.com, once the package exists there:

1. Publish the first version outside CI (`npm publish --access public`), because
   a trusted publisher is configured on an existing package.
2. Package settings → **Trusted Publishers** → **GitHub Actions**, then register:
   - Organization or user: `spark-ai-boy`
   - Repository: `dsh-tls-trust-anchor`
   - Workflow filename: `publish-npm.yml`
   - Environment: leave empty
3. Delete any `NPM_TOKEN` secret you used for that first publish.

Then release with a tag whose name matches the package version:

```bash
npm version patch --no-git-tag-version   # or minor / major
git commit -am "chore: release $(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push --follow-tags
```

`publish-npm.yml` runs on the tag, refuses to publish when the tag and
`package.json` version disagree, and skips a version already on the registry.
`release.yml` then creates the GitHub Release and attaches the `.tgz`.
`workflow_dispatch` publishes the current commit's version manually.

## Conventions

- Remote method signatures: keep parameter names free of destructuring, defaults, and rest. Without a generated Typert artifact the gateway reads them from source and validates Client calls against them, so a mismatch fails with `args fields do not match the descriptor`.
- Keep the package name, the patch row `name`, the module loader `id`, and the Remote contribution `package` identical; `tests/manifest.test.js` enforces this.
- Do not add a `tls.connect` patch that keys off anything other than an explicit hostname allow-list. Disabling verification globally is out of scope.
