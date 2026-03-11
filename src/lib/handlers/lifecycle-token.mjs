/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/lifecycle-token.mjs
 *	@Date: 2026-02-23 00:00:00 -08:00 (1771891200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:37 -08:00 (1772425297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Per-instance lifecycle capability token management.
 *
 * Provides an unforgeable capability token system for tagSystemMetadata(). Tokens are
 * created fresh per Slothlet instance at load time and stored in a module-private WeakMap.
 * No token constant is ever exported — importing this file only yields three functions.
 *
 * ### Why not a module-level exported Symbol?
 * Node.js caches ES module evaluations. Any code that can resolve the file path of this
 * module receives the SAME module object — and thus the same Symbol — as the internal
 * runtime. A static exported Symbol is therefore equivalent to a public constant.
 *
 * ### This design
 * - Token is a Symbol created at runtime per Slothlet instance (`registerInstance`)
 * - Stored exclusively in a module-private WeakMap — no exportable reference exists
 * - `getInstanceToken(slothlet)` is the only retrieval path (requires live instance)
 * - `verifyToken(slothlet, token)` checks identity without leaking the value
 *
 * Do NOT add any token-value export to this file or to the package.json exports map.
 *
 * @module @cldmv/slothlet/handlers/lifecycle-token
 * @internal
 * @package
 */

/**
 * Module-private map of Slothlet instance → per-instance capability token.
 * Never exported — the only way to interact with it is through the three functions below.
 *
 * @type {WeakMap<object, symbol>}
 */
const instanceTokens = new WeakMap();

/**
 * Registers a Slothlet instance and creates its per-instance lifecycle capability token.
 *
 * Safe to call multiple times on the same instance (idempotent) — subsequent calls are
 * silently ignored, preserving the original token. This handles the reload code path where
 * `load()` is called again on the same Slothlet object.
 *
 * @param {object} slothlet - The Slothlet instance to register.
 * @returns {void}
 * @package
 *
 * @example
 * // Called once (or on reload) in Slothlet.load():
 * registerInstance(this);
 */
function registerInstance(slothlet) {
	if (instanceTokens.has(slothlet)) {
		// Already registered — reload path calls load() again on the same instance.
		// The existing token remains valid; nothing to do.
		return;
	}
	instanceTokens.set(slothlet, Symbol("@cldmv/slothlet/lifecycle.tagToken"));
}

/**
 * Returns the per-instance capability token for the given Slothlet instance.
 *
 * Used internally by `lifecycle.mjs` (emit dispatch) and `modes-processor.mjs`
 * (direct tagSystemMetadata call for folder wrappers). Requires a live registered
 * Slothlet instance — cannot be exploited without one.
 *
 * @param {object} slothlet - A registered Slothlet instance.
 * @returns {symbol|undefined} The instance token, or undefined if not registered.
 * @package
 *
 * @example
 * handler(data, getInstanceToken(this.slothlet));
 */
function getInstanceToken(slothlet) {
	return instanceTokens.get(slothlet);
}

/**
 * Verifies that `token` is the registered capability token for the given Slothlet instance.
 *
 * Used by `metadata.mjs` inside `tagSystemMetadata()` to reject calls that did not
 * originate from the internal lifecycle dispatch path.
 *
 * @param {object} slothlet - A registered Slothlet instance.
 * @param {*} token - The token value to verify.
 * @returns {boolean} `true` only if `token` is the exact Symbol registered for `slothlet`.
 * @package
 *
 * @example
 * if (!verifyToken(this.slothlet, token)) {
 *   throw new this.SlothletError("METADATA_LIFECYCLE_BYPASS", ...);
 * }
 */
function verifyToken(slothlet, token) {
	return token === instanceTokens.get(slothlet);
}

export { registerInstance, getInstanceToken, verifyToken };
