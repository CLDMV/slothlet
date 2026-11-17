/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/trusted-root.mjs
 *	@Date: 2026-07-10T00:00:00-07:00 (1783666800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:10-08:00 (1794874570)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Trusted-root markers and genuine-wrapper registry for permission hardening.
 * @module @cldmv/slothlet/handlers/trusted-root
 * @internal
 *
 * @description
 * Shared, module-private symbols/registries used by permission enforcement to distinguish
 * genuinely host-initiated calls from calls made inside an active context.
 *
 * - `TRUSTED_ROOT` marks the base context store created when a slothlet instance is set up. When a
 *   call/read occurs with **no active context** and the instance's base store carries this marker,
 *   the call is treated as host-initiated (allowed). This lets enforcement fail closed on a
 *   missing/forged caller inside a context while keeping ordinary external host calls working.
 * - `genuineWrappers` is a `WeakSet` of every real `UnifiedWrapper` instance. A caller identity
 *   (`ctx.currentWrapper`) that is not in this set is a forged object and is denied.
 * - `PROTECT_SENTINEL` marks owner-locked ("protected") context keys (used by owner-locked keys,
 *   H5): a key whose owner is this sentinel is write-once/unowned and can never be written by
 *   module-land code.
 *
 * These are reachable only via the package-internal `#handlers/trusted-root` specifier — never a
 * public export — so module-land code can neither read the markers nor spoof registry membership.
 */

import { SlothletError } from "#errors";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import {
	ArrayMethods,
	Arrays,
	concatLists,
	Dates,
	filterList,
	FunctionMethods,
	listPush,
	Map,
	mapKeysToArray,
	mapList,
	MapMethods,
	Math,
	NativeProxy,
	NumberMethods,
	Objects,
	Reflect,
	String,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const { markSlothletProxy } = frameworkInternalsInternals("lib/handlers/trusted-root");

/**
 * Marker set on a slothlet instance's base context store to identify host-initiated calls.
 * @type {symbol}
 * @internal
 */
const TRUSTED_ROOT = Symbol("slothlet.trustedRoot");

/**
 * Registry of every genuine `UnifiedWrapper` instance. A caller identity absent from this set is a
 * forged object and is denied by permission enforcement.
 * @type {WeakSet<object>}
 * @internal
 */
const genuineWrappers = new WeakSet();

/**
 * Each leaf function slothlet wraps, to the wrapper it is the function of (#597): a leaf's function handed to another
 * call as a value — imported raw from its file rather than read from `self` — is recognised as that api node.
 * @type {WeakMap<Function, object>}
 * @internal
 */
const implWrappers = new WeakMap();

/**
 * Every ceiling chain {@link combineCeilings} built: a frozen list of the calls code supplied to another call
 * runs under (#597), told apart from a single call's wrapper by membership here.
 * @type {WeakSet<ReadonlyArray<object>>}
 * @private
 */
const CEILING_CHAINS = new WeakSet();

/**
 * A number for each call that has been part of a ceiling, so a chain's members can be put in one order.
 * @type {WeakMap<object, number>}
 * @private
 */
const CEILING_ORDER = new WeakMap();

/**
 * The next number {@link CEILING_ORDER} hands out.
 * @type {number}
 * @private
 */
let nextCeilingOrder = 0;

/**
 * The chains already built, as a trie over their members in {@link CEILING_ORDER} order, so one set of calls
 * is always the same chain: a chain is a cache key (a per-reader view, a captured function).
 * @type {{next: WeakMap<object, object>, chain: ReadonlyArray<object>|null}}
 * @private
 */
const CEILING_TRIE = { next: new WeakMap(), chain: null };

/**
 * No ceiling.
 * @type {ReadonlyArray<object>}
 * @private
 */
const NO_CEILING = Objects.freeze([]);

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
export function ceilingMembers(ceiling) {
	if (!ceiling) return NO_CEILING;
	return WeakSetMethods.has(CEILING_CHAINS, ceiling) ? ceiling : [ceiling];
}

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
export function combineCeilings(...parts) {
	let single = null;
	let members = null;
	for (let ofIndex = 0, ofList = parts; ofIndex < ofList.length; ofIndex++) {
		const part = ofList[ofIndex];
		for (let ofIndex = 0, ofList = ceilingMembers(part); ofIndex < ofList.length; ofIndex++) {
			const member = ofList[ofIndex];
			if (member === single || (members == null ? undefined : ArrayMethods.includes(members, member))) continue;
			if (single === null && members === null) single = member;
			else listPush((members ??= [single]), member);
		}
	}
	if (members === null) return single;
	for (let ofIndex = 0, ofList = members; ofIndex < ofList.length; ofIndex++) {
		const member = ofList[ofIndex];
		if (!WeakMapMethods.has(CEILING_ORDER, member)) WeakMapMethods.set(CEILING_ORDER, member, nextCeilingOrder++);
	}
	ArrayMethods.sort(members, (a, b) => WeakMapMethods.get(CEILING_ORDER, a) - WeakMapMethods.get(CEILING_ORDER, b));
	let node = CEILING_TRIE;
	for (let ofIndex = 0, ofList = members; ofIndex < ofList.length; ofIndex++) {
		const member = ofList[ofIndex];
		let child = WeakMapMethods.get(node.next, member);
		if (!child) {
			child = { next: new WeakMap(), chain: null };
			WeakMapMethods.set(node.next, member, child);
		}
		node = child;
	}
	if (!node.chain) {
		node.chain = Objects.freeze(members);
		WeakSetMethods.add(CEILING_CHAINS, node.chain);
	}
	return node.chain;
}

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
export function identityCeilings(identity) {
	if (!identity?.currentWrapper || !identity.ceiling) return NO_CEILING;
	const members = ceilingMembers(identity.ceiling);
	return ArrayMethods.includes(members, identity.currentWrapper)
		? filterList(members, (member) => member !== identity.currentWrapper)
		: members;
}

/**
 * Sentinel owner for write-once/unowned ("protected") context keys.
 * @type {symbol}
 * @internal
 */
const PROTECT_SENTINEL = Symbol("slothlet.protect");

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
function enforceContextKeyWrite(ctx, prop) {
	// A top-level write: the key that owns the write and the path reported in the error are the same.
	enforceOwnedContextWrite(ctx, prop, String(prop));
}

/**
 * Core owner-lock check shared by top-level context writes and nested protected-view writes (#207).
 * Ownership is resolved from `ownerKey` (always a top-level context key); `pathKey` is the display
 * path reported in the error — the key itself for a top-level write (`auth`), or the full dotted path
 * for a nested write (`auth.userId`).
 *
 * The claim (`__contextOwners`) and the writer come from two stores that are usually — but not
 * always — the same object. A nested protected view outlives the single proxy-trap call it was
 * created in (it is cached, and it can be handed across module calls), while the writer identity is
 * a property of whichever store is active at WRITE time: in the async runtime every module call
 * runs in its own derived store carrying that call's `currentWrapper`. So the view passes the
 * call-time store as `writerCtx` while ownership stays bound to the wrap-time claim (PR #208
 * review) — otherwise a view created under one identity would keep enforcing AS that identity for
 * every later writer (a host-primed view denying the rightful owner; a module-created view leaking
 * its authority to the host it returned the value to).
 *
 * @param {object} ctx - The store whose `__contextOwners` claim governs this write.
 * @param {string|symbol} ownerKey - The top-level context key whose owner governs this write.
 * @param {string} pathKey - Full path of the property being written, reported in the error message.
 * @param {object} [writerCtx=ctx] - The store the writer identity is resolved from (the active
 *   call-time store for nested view writes; defaults to `ctx` for top-level set-trap writes).
 * @returns {void}
 * @throws {SlothletError} CONTEXT_KEY_PROTECTED when the write is not permitted by the key's owner.
 * @internal
 */
function enforceOwnedContextWrite(ctx, ownerKey, pathKey, writerCtx = ctx) {
	const owners = ctx?.__contextOwners;
	// `owners` is a null-prototype map (see `buildContextOwners` in api_builder.mjs), but the lookup
	// still goes through `hasOwnProperty` rather than a bare `owners[ownerKey]` as a second, independent
	// guard: a caller-supplied key like "__proto__" or "constructor" must never be resolved as an
	// inherited property (of the map itself, or of whatever `owners` turns out to be) and mistaken
	// for an existing claim.
	if (!owners || !FunctionMethods.call(Objects.prototype.hasOwnProperty, owners, ownerKey)) return;
	const owner = owners[ownerKey];
	// The writers are who is executing — resolved the way the call gate resolves its caller — and, for code a caller
	// supplied to another module's call, every call of the ceiling it runs under (#597): each of them has to own the
	// key, so supplied code can write a key only where both it and the leaf it runs inside could. Host writes have no
	// writer.
	const writers = mapList(writersOf(writerCtx), (wrapper) => wrapper?.____slothletInternal?.apiPath ?? null);
	const writer = writers[0] ?? null;
	if (owner === PROTECT_SENTINEL) {
		throw new SlothletError("CONTEXT_KEY_PROTECTED", { key: pathKey, owner: "protected", writer: writer ?? "host" }, null, {
			validationError: true
		});
	}
	// A writer identity is an executing module's full leaf apiPath (e.g. `callers.dataReader.write`).
	// An owner name matches that leaf exactly OR as a module prefix (`callers.dataReader` owns every
	// leaf under it), so a module can own a key without naming each of its functions.
	const refused = writers.length
		? ArrayMethods.find(writers, (path) => !(path !== null && (path === owner || StringMethods.startsWith(path, owner + "."))))
		: null;
	if (!writers.length || refused !== undefined) {
		throw new SlothletError(
			"CONTEXT_KEY_PROTECTED",
			{ key: pathKey, owner: String(owner), writer: (writers.length ? refused : null) ?? "host" },
			null,
			{ validationError: true }
		);
	}
}

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
function writersOf(store) {
	const slothlet = store?.slothlet;
	const identity = slothlet?.contextManager?.getCallerIdentity?.(slothlet.instanceID) ?? {
		currentWrapper: store?.currentWrapper ?? null,
		ceiling: store?.currentCeiling ?? null
	};
	// A writer that cannot be told apart is no one's, and not the host either.
	if (identity.unresolved) throw new SlothletError("PERMISSION_DENIED", { caller: null, target: "self" }, null, { validationError: true });
	if (!identity.currentWrapper) return [];
	return concatLists([identity.currentWrapper], identityCeilings(identity));
}

/**
 * Per-store cache of protected-view proxies: a `Map` keyed by owner key, holding a `WeakMap` keyed
 * by the raw context value. The per-owner-key level matters (PR #208 review): one object aliased
 * under two differently-owned keys must get two views — each enforcing its own key's owner and
 * reporting its own path — where a value-only cache would reuse whichever key's view was created
 * first and enforce the wrong owner depending on read order. Within a key, the WeakMap guarantees a
 * stable identity for repeated reads (`context.auth === context.auth`) and avoids re-wrapping.
 * Lives on the active store, so it is discarded with the scope.
 * @type {symbol}
 * @internal
 */
const PROTECTED_VIEW_CACHE = Symbol("slothlet.protectedViewCache");

/**
 * Whether a context value should be wrapped in a protected view. Only plain objects and arrays are
 * wrapped: their nested writes route through the proxy set-trap and get enforced. "Plain" includes
 * null-prototype objects (the same definition builder.mjs's `isPlainObject` uses) — treating them
 * as non-plain would hand a protected `Object.create(null)` value back raw and let nested writes
 * bypass the lock (PR #208 review). Primitives, `null`, and non-plain objects (Date/Map/Set/class
 * instances) are returned raw — wrapping the latter would break their methods (a wrong `this`
 * receiver) without actually guarding them (they mutate through methods, not property writes), so
 * they remain a documented depth caveat.
 *
 * @param {*} value - The context value.
 * @returns {boolean} True for a plain object (including null-prototype) or array.
 * @internal
 */
function isWrappableContextValue(value) {
	if (value === null || typeof value !== "object") return false;
	if (Arrays.isArray(value)) return true;
	const proto = Objects.getPrototypeOf(value);
	return proto === Objects.prototype || proto === null;
}

/**
 * Wrap an owner-locked context value in a recursive "protected view" so writes to its nested fields
 * are enforced against the owning key exactly like a top-level write (#207). Reads pass through
 * (nested plain objects/arrays are wrapped on the way out); `set` / `defineProperty` / `deleteProperty`
 * at any depth run the owner check with the full path and throw CONTEXT_KEY_PROTECTED when the caller
 * does not own the key. Non-wrappable values are returned raw. Views are memoized per store and per
 * owner key, so a value's view keeps a stable identity across reads within a key.
 *
 * Enforcement splits its two inputs deliberately (PR #208 review): the ownership claim stays bound
 * to the wrap-time store (`ctx`), while the WRITER is resolved from the runtime's active store at
 * write time (`getContext() ?? ctx` — the fallback covers a view used after its scope ended, which
 * stays locked rather than failing open). A view outlives the trap call that created it, so a
 * wrap-time writer snapshot would enforce as whoever first touched the value.
 *
 * Display-path caveat (deliberate): when one nested object is reachable through several paths under
 * the SAME key (`context.auth.a === context.auth.b`), the memoized view keeps the first-read path,
 * so an error for a write via the other alias reports the sibling path (`auth.a.x` for a write via
 * `auth.b.x`). The enforcement verdict is identical either way — both aliases resolve the same
 * `ownerKey`, and only `pathKey` (a diagnostic label) differs. Keying views by path instead would
 * fix the label but break `view === view` across aliases of one object — trading a real, observable
 * identity property for a cosmetic one. The label stays best-effort; the alias identity stays exact.
 *
 * @param {object} ctx - The context store whose claim this view enforces.
 * @param {function(): object|null} getContext - The runtime's active-store resolver (call-time writer identity).
 * @param {string|symbol} ownerKey - The top-level owner-locked key this value belongs to. Typed to
 *   match `readProtectedContextValue`'s `prop` (a proxy-trap key, hence `string|symbol`); in practice
 *   always a string, since the `hasOwnProperty(owners, prop)` guard only reaches here for keys that
 *   exist in the null-proto owners map, whose keys come from the string-validated `protect`/`owners`.
 * @param {*} value - The value to wrap (raw).
 * @param {string} path - Display path of `value` from the context root (e.g. `auth`, `auth.profile`).
 * @returns {*} A protected-view proxy for a plain object/array, otherwise `value` unchanged.
 * @internal
 */
function makeProtectedContextView(ctx, getContext, ownerKey, value, path) {
	if (!isWrappableContextValue(value)) return value;
	// Scope the lookup by ownerKey BEFORE the per-value WeakMap — see PROTECTED_VIEW_CACHE: a view
	// is bound to the owner it enforces, so an object aliased under two differently-owned keys must
	// never share one view across them.
	let caches = ctx[PROTECTED_VIEW_CACHE];
	if (!caches) caches = ctx[PROTECTED_VIEW_CACHE] = new Map();
	let cache = MapMethods.get(caches, ownerKey);
	if (!cache) MapMethods.set(caches, ownerKey, (cache = new WeakMap()));
	const cached = WeakMapMethods.get(cache, value);
	if (cached) return cached;
	const view = markSlothletProxy(
		new NativeProxy(value, {
			get(target, prop, receiver) {
				// Recurse so deeper plain objects/arrays are guarded too; primitives/functions fall through raw.
				return makeProtectedContextView(ctx, getContext, ownerKey, Reflect.get(target, prop, receiver), `${path}.${String(prop)}`);
			},
			set(target, prop, newValue, receiver) {
				enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
				// Forward `receiver` (the view), matching the get-trap, so an accessor setter runs with
				// `this` = the view and its internal writes stay routed through these traps. Not a security
				// requirement — enforcement is keyed on the top-level owner, who owns every nested path, so
				// the write that triggers a setter is already gated — but it keeps proxy semantics correct.
				return Reflect.set(target, prop, newValue, receiver);
			},
			defineProperty(target, prop, descriptor) {
				enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
				return Reflect.defineProperty(target, prop, descriptor);
			},
			deleteProperty(target, prop) {
				enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
				return Reflect.deleteProperty(target, prop);
			}
		})
	);
	WeakMapMethods.set(cache, value, view);
	return view;
}

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
function readProtectedContextValue(ctx, prop, getContext) {
	const owners = ctx.__contextOwners;
	if (owners && FunctionMethods.call(Objects.prototype.hasOwnProperty, owners, prop)) {
		return makeProtectedContextView(ctx, getContext, prop, ctx.context[prop], String(prop));
	}
	return ctx.context[prop];
}

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
function buildCapturedFlowStore(instances, instanceID, captured) {
	const baseStore = MapMethods.get(instances, instanceID);
	if (!baseStore) {
		throw new SlothletError("CONTEXT_NOT_FOUND", {
			instanceID,
			availableInstances: ArrayMethods.join(mapKeysToArray(instances), ", ") || "none"
		});
	}
	const childStore = {
		instanceID: `${instanceID}__run_${Dates.now()}_${StringMethods.slice(NumberMethods.toString(Math.random(), 36), 2, 9)}`,
		context: captured.context,
		self: baseStore.self,
		config: baseStore.config,
		createdAt: baseStore.createdAt,
		parentInstanceID: instanceID,
		currentWrapper: captured.currentWrapper,
		callerWrapper: captured.callerWrapper,
		// A supplier's identity keeps the call it ran inside as its ceiling when replayed (#597).
		currentCeiling: captured.ceiling ?? null,
		callerCeiling: captured.callerCeiling ?? null,
		slothlet: baseStore.slothlet,
		__contextOwners: captured.contextOwners
	};
	if (captured.trusted) {
		Objects.defineProperty(childStore, TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });
	}
	return childStore;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/builders/api_builder",
			"lib/handlers/context-async",
			"lib/handlers/context-live",
			"lib/handlers/frame-placement",
			"lib/handlers/unified-wrapper",
			"lib/runtime/runtime-asynclocalstorage",
			"lib/runtime/runtime-livebindings",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/handlers/trusted-root", import.meta.url);
	return {
		get PROTECT_SENTINEL() {
			return PROTECT_SENTINEL;
		},
		get TRUSTED_ROOT() {
			return TRUSTED_ROOT;
		},
		buildCapturedFlowStore,
		enforceContextKeyWrite,
		get genuineWrappers() {
			return genuineWrappers;
		},
		get implWrappers() {
			return implWrappers;
		},
		readProtectedContextValue,
		writersOf
	};
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof genuineWrappers} */
const guarded_genuineWrappers = guardInternal(genuineWrappers, "genuineWrappers", import.meta.url);
/** @type {typeof implWrappers} */
const guarded_implWrappers = guardInternal(implWrappers, "implWrappers", import.meta.url);
/** @type {typeof enforceContextKeyWrite} */
const guarded_enforceContextKeyWrite = guardInternal(enforceContextKeyWrite, "enforceContextKeyWrite", import.meta.url);
/** @type {typeof writersOf} */
const guarded_writersOf = guardInternal(writersOf, "writersOf", import.meta.url);
/** @type {typeof readProtectedContextValue} */
const guarded_readProtectedContextValue = guardInternal(readProtectedContextValue, "readProtectedContextValue", import.meta.url);
/** @type {typeof buildCapturedFlowStore} */
const guarded_buildCapturedFlowStore = guardInternal(buildCapturedFlowStore, "buildCapturedFlowStore", import.meta.url);
export {
	guarded_genuineWrappers as genuineWrappers,
	guarded_implWrappers as implWrappers,
	guarded_enforceContextKeyWrite as enforceContextKeyWrite,
	guarded_writersOf as writersOf,
	guarded_readProtectedContextValue as readProtectedContextValue,
	guarded_buildCapturedFlowStore as buildCapturedFlowStore
};
