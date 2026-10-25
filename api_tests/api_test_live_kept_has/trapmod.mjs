/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_has/trapmod.mjs
 *	@Date: 2026-10-25T10:07:47-07:00 (1792948067)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T10:30:43-07:00 (1792949443)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): an object whose prototype is a Proxy that runs code another module asked to run
 * whenever the object is asked whether it has a member.
 */

/** @type {Function|null} The code to run. */
let onAsk = null;

/**
 * Run `hook` whenever `tbox` is asked whether it has a member.
 * @param {Function} hook - The hook.
 * @returns {string} "set".
 */
export function whenAsked(hook) {
	onAsk = hook;
	return "set";
}

/** @type {object} A prototype that runs that code. */
const askingProto = new Proxy(
	{},
	{
		has(target, prop) {
			if (onAsk) onAsk();
			return Reflect.has(target, prop);
		}
	}
);

/** @type {{secret: number, a: number}} An object one module may not read the `secret` of. */
export const tbox = Object.setPrototypeOf({ secret: 42, a: 1 }, askingProto);
