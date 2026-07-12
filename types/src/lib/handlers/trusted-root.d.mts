/**
 * Enforce owner-locking on a runtime `context` set-trap write. If `prop` is an owner-locked key on
 * the active store, the write is allowed only when the writing caller matches the declared owner:
 * a `PROTECT_SENTINEL` owner is write-once/unowned (never writable via the set trap), and a named
 * owner (a caller apiPath) permits only the caller whose current identity equals that name.
 *
 * @param {object} ctx - The active context store (carries `__contextOwners` and `currentWrapper`).
 * @param {string|symbol} prop - The context key being written.
 * @returns {void}
 * @throws {SlothletError} CONTEXT_KEY_PROTECTED when the write is not permitted by the key's owner.
 * @internal
 */
export function enforceContextKeyWrite(ctx: object, prop: string | symbol): void;
/**
 * Marker set on a slothlet instance's base context store to identify host-initiated calls.
 * @type {symbol}
 * @internal
 */
export const TRUSTED_ROOT: symbol;
/**
 * Registry of every genuine `UnifiedWrapper` instance. A caller identity absent from this set is a
 * forged object and is denied by permission enforcement.
 * @type {WeakSet<object>}
 * @internal
 */
export const genuineWrappers: WeakSet<object>;
/**
 * Sentinel owner for write-once/unowned ("protected") context keys.
 * @type {symbol}
 * @internal
 */
export const PROTECT_SENTINEL: symbol;
//# sourceMappingURL=trusted-root.d.mts.map