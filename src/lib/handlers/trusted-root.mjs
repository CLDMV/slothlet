/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/trusted-root.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Marker set on a slothlet instance's base context store to identify host-initiated calls.
 * @type {symbol}
 * @internal
 */
export const TRUSTED_ROOT = Symbol("slothlet.trustedRoot");

/**
 * Registry of every genuine `UnifiedWrapper` instance. A caller identity absent from this set is a
 * forged object and is denied by permission enforcement.
 * @type {WeakSet<object>}
 * @internal
 */
export const genuineWrappers = new WeakSet();

/**
 * Sentinel owner for write-once/unowned ("protected") context keys.
 * @type {symbol}
 * @internal
 */
export const PROTECT_SENTINEL = Symbol("slothlet.protect");

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
export function enforceContextKeyWrite(ctx, prop) {
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
	if (!owners || !Object.prototype.hasOwnProperty.call(owners, ownerKey)) return;
	const owner = owners[ownerKey];
	// The writer's identity is the currently-executing module's apiPath (same derivation the call
	// gate uses); host writes have no currentWrapper.
	const writer = writerCtx.currentWrapper?.____slothletInternal?.apiPath ?? null;
	if (owner === PROTECT_SENTINEL) {
		throw new SlothletError("CONTEXT_KEY_PROTECTED", { key: pathKey, owner: "protected", writer: writer ?? "host" }, null, {
			validationError: true
		});
	}
	// The writer identity is the executing module's full leaf apiPath (e.g. `callers.dataReader.write`).
	// An owner name matches that leaf exactly OR as a module prefix (`callers.dataReader` owns every
	// leaf under it), so a module can own a key without naming each of its functions.
	const owned = writer !== null && (writer === owner || writer.startsWith(owner + "."));
	if (!owned) {
		throw new SlothletError("CONTEXT_KEY_PROTECTED", { key: pathKey, owner: String(owner), writer: writer ?? "host" }, null, {
			validationError: true
		});
	}
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
	if (Array.isArray(value)) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
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
 * @param {object} ctx - The context store whose claim this view enforces.
 * @param {function(): object|null} getContext - The runtime's active-store resolver (call-time writer identity).
 * @param {string} ownerKey - The top-level owner-locked key this value belongs to.
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
	let cache = caches.get(ownerKey);
	if (!cache) caches.set(ownerKey, (cache = new WeakMap()));
	const cached = cache.get(value);
	if (cached) return cached;
	const view = new Proxy(value, {
		get(target, prop, receiver) {
			// Recurse so deeper plain objects/arrays are guarded too; primitives/functions fall through raw.
			return makeProtectedContextView(ctx, getContext, ownerKey, Reflect.get(target, prop, receiver), `${path}.${String(prop)}`);
		},
		set(target, prop, newValue) {
			enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
			return Reflect.set(target, prop, newValue);
		},
		defineProperty(target, prop, descriptor) {
			enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
			return Reflect.defineProperty(target, prop, descriptor);
		},
		deleteProperty(target, prop) {
			enforceOwnedContextWrite(ctx, ownerKey, `${path}.${String(prop)}`, getContext() ?? ctx);
			return Reflect.deleteProperty(target, prop);
		}
	});
	cache.set(value, view);
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
export function readProtectedContextValue(ctx, prop, getContext) {
	const owners = ctx.__contextOwners;
	if (owners && Object.prototype.hasOwnProperty.call(owners, prop)) {
		return makeProtectedContextView(ctx, getContext, prop, ctx.context[prop], String(prop));
	}
	return ctx.context[prop];
}
