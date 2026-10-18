/**
 * The calls a ceiling names: none, the one call it is, or every call of a chain (#597).
 *
 * @param {object|ReadonlyArray<object>|null|undefined} ceiling - A ceiling.
 * @returns {ReadonlyArray<object>} Its calls.
 * @internal
 *
 * @example
 * ceilingMembers(null); // []
 * ceilingMembers(wrapper); // [wrapper]
 */
export function ceilingMembers(ceiling: object | ReadonlyArray<object> | null | undefined): ReadonlyArray<object>;
/**
 * One ceiling holding every call of the ceilings given (#597). Ceilings only accumulate: code supplied to a
 * call keeps the call it runs inside, every call that call ran inside, and any ceiling those already carried.
 *
 * The answer is `null` for no call, the call itself for one, and otherwise a frozen chain that is the same
 * object for the same set of calls in whatever order they are given.
 *
 * @param {...(object|ReadonlyArray<object>|null|undefined)} parts - Calls and ceilings.
 * @returns {object|ReadonlyArray<object>|null} The combined ceiling.
 * @internal
 *
 * @example
 * combineCeilings(leaf, null, record.ceiling); // leaf, or a chain of leaf and record.ceiling's calls
 */
export function combineCeilings(...parts: (object | ReadonlyArray<object> | null | undefined)[]): object | ReadonlyArray<object> | null;
/**
 * The ceiling an identity runs under, without the identity's own call: the calls that have to allow what its
 * `currentWrapper` does as well (#597). Empty for the host and for an identity with no ceiling.
 *
 * @param {{currentWrapper?: object|null, ceiling?: object|ReadonlyArray<object>|null}|null|undefined} identity - A caller identity.
 * @returns {ReadonlyArray<object>} The other calls.
 * @internal
 *
 * @example
 * for (const call of identityCeilings(identity)) enforce(call);
 */
export function identityCeilings(identity: {
    currentWrapper?: object | null;
    ceiling?: object | ReadonlyArray<object> | null;
} | null | undefined): ReadonlyArray<object>;
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
 * Who writes from a store: the identity executing in it, as the context manager resolves it, followed by every call
 * of the ceiling it runs under (#597). Empty for the host. A store with no instance to ask (a view used after its
 * scope ended) answers from its own fields.
 *
 * @param {object} store - The store the write is made from.
 * @returns {Array<object>} The writing wrappers, the executing one first.
 * @throws {SlothletError} PERMISSION_DENIED when who is executing cannot be told.
 * @internal
 */
export function writersOf(store: object): Array<object>;
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
 * Build the context store a {@link snapshotFlow}-snapshotted flow is replayed in (#497), shared by the
 * async and live context managers. The store is a `run()`/`scope()`-style child of the instance's
 * CURRENT base store — fresh `self` / `config` / `slothlet` references, so a snapshot taken before a
 * reload runs against the reloaded instance — carrying the snapshot's user context, caller identity,
 * owner-locked keys and host trust. The deliverer's own ambient context is deliberately not merged
 * in: the flow is the emitter's, not whoever replays it.
 *
 * @param {Map<string, object>} instances - The context manager's instance-store registry.
 * @param {string} instanceID - The instance to replay against.
 * @param {object} captured - The snapshot (`{ context, currentWrapper, callerWrapper, ceiling, callerCeiling, contextOwners, trusted }`).
 * @returns {object} The child store (not yet registered).
 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
 * @internal
 */
export function buildCapturedFlowStore(instances: Map<string, object>, instanceID: string, captured: object): object;
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
 * Each leaf function slothlet wraps, to the wrapper it is the function of (#597): a leaf's function handed to another
 * call as a value — imported raw from its file rather than read from `self` — is recognised as that api node.
 * @type {WeakMap<Function, object>}
 * @internal
 */
export const implWrappers: WeakMap<Function, object>;
/**
 * Sentinel owner for write-once/unowned ("protected") context keys.
 * @type {symbol}
 * @internal
 */
export const PROTECT_SENTINEL: symbol;
//# sourceMappingURL=trusted-root.d.mts.map