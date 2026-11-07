/** Quote a path that NODE_OPTIONS would otherwise split on spaces. */
function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

/**
 * Append `--require <preload>` to a NODE_OPTIONS value without duplicating it
 * and without discarding flags the user or the Harness already set.
 */
export function withPreload(current, preload) {
  const base = String(current ?? '').trim();
  if (base.includes(preload)) return base;
  const flag = `--require ${quoteIfNeeded(preload)}`;
  return base.length > 0 ? `${base} ${flag}` : flag;
}
