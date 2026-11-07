## Summary

## User impact

## TLS trust impact

- [ ] Verification is never disabled outside the explicit host allow-list
- [ ] Hostnames are still normalized before matching
- [ ] The persisted state format stays backward compatible
- [ ] The Client descriptors and Host method signatures still agree

## Verification

- [ ] `npm run check`
- [ ] Tests added or updated
- [ ] Plugin activates in a profile (`fiberPhase: active`)
