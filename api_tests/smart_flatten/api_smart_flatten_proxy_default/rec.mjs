/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_proxy_default/rec.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a Proxy default that records every write to its target, plus named exports.
 * Composition must leave the module's own default untouched.
 * @module api_smart_flatten_proxy_default.rec
 */

const writes = [];
const target = {
	base() {
		return "rec.base";
	}
};

export default new Proxy(target, {
	get(t, key) {
		return key === "virtual" ? "rec.virtual" : Reflect.get(t, key);
	},
	set(t, key, value) {
		writes.push(String(key));
		return Reflect.set(t, key, value);
	},
	defineProperty(t, key, descriptor) {
		writes.push(String(key));
		return Reflect.defineProperty(t, key, descriptor);
	}
});

/**
 * Number of writes the Proxy's target received.
 * @returns {number} Write count.
 */
export function writeCount() {
	return writes.length;
}

/**
 * The target's own keys, as the module sees them.
 * @returns {string} Comma-separated keys.
 */
export function targetKeys() {
	return Object.keys(target).join(",");
}
