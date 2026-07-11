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
export function enforceContextKeyWrite(ctx, prop) {
	const owners = ctx?.__contextOwners;
	// `owners` is a null-prototype map (see `buildContextOwners` in api_builder.mjs), but the lookup
	// still goes through `hasOwnProperty` rather than a bare `owners[prop]` as a second, independent
	// guard: a caller-supplied `prop` like "__proto__" or "constructor" must never be resolved as an
	// inherited property (of the map itself, or of whatever `owners` turns out to be) and mistaken
	// for an existing claim.
	if (!owners || !Object.prototype.hasOwnProperty.call(owners, prop)) return;
	const owner = owners[prop];
	// The writer's identity is the currently-executing module's apiPath (same derivation the call
	// gate uses); host writes have no currentWrapper.
	const writer = ctx.currentWrapper?.____slothletInternal?.apiPath ?? null;
	if (owner === PROTECT_SENTINEL) {
		throw new SlothletError("CONTEXT_KEY_PROTECTED", { key: String(prop), owner: "protected", writer: writer ?? "host" }, null, {
			validationError: true
		});
	}
	// The writer identity is the executing module's full leaf apiPath (e.g. `callers.dataReader.write`).
	// An owner name matches that leaf exactly OR as a module prefix (`callers.dataReader` owns every
	// leaf under it), so a module can own a key without naming each of its functions.
	const owned = writer !== null && (writer === owner || writer.startsWith(owner + "."));
	if (!owned) {
		throw new SlothletError("CONTEXT_KEY_PROTECTED", { key: String(prop), owner: String(owner), writer: writer ?? "host" }, null, {
			validationError: true
		});
	}
}
