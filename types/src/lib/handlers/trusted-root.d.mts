/**
 * Enforce owner-locking on a top-level runtime `context` set-trap write. If `prop` is an owner-locked
 * key on the active store, the write is allowed only when the writing caller matches the declared
 * owner: a `PROTECT_SENTINEL` owner is write-once/unowned (never writable via the set trap), and a
 * named owner (a caller apiPath) permits only the caller whose current identity equals that name.
 *
 * @param {object} ctx - The active context store (carries `__contextOwners` and `currentWrapper`).
 * @param {string|symbol} prop - The context key being written.
 * @returns {void}
 * @throws {SlothletError} CONTEXT_KEY_PROTECTED when the write is not permitted by the key's owner.
 * @internal
 */
export function enforceContextKeyWrite(ctx: object, prop: string | symbol): void;
/**
 * Resolve a runtime `context` get-trap read. For an owner-locked key (declared via
 * `scope({ protect, owners })`) whose value is a plain object or array, returns a recursive protected
 * view so nested writes stay enforced (#207); for every other key it returns the raw value, leaving
 * unprotected context reads (and non-wrappable protected values) exactly as before.
 *
 * @param {object} ctx - The active context store.
 * @param {string|symbol} prop - The context key being read.
 * @param {function(): object|null} getContext - The runtime's active-store resolver, threaded into
 *   the view so nested writes resolve the writer at write time (see makeProtectedContextView).
 * @returns {*} The raw value, or a protected view when the key is owner-locked and wrappable.
 * @internal
 */
export function readProtectedContextValue(ctx: object, prop: string | symbol, getContext: () => object | null): any;
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