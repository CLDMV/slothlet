/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/holder/deep/cfg.mjs
 *	@Date: 2026-11-03T08:00:39-08:00 (1793721639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T08:38:45-08:00 (1793723925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Exports whose shape decides whether a write through them stands (#653).
 */

/**
 * A frozen export: a write through its node overrides it on the node, as in eager mode.
 * @type {{a: number}}
 */
export const frozen = Object.freeze({ a: 1 });

/**
 * An export with a getter and no setter: assigning the member is refused.
 * @type {{g: number}}
 */
export const getterOnly = {
	get g() {
		return 1;
	}
};

/**
 * An export with a getter and no setter, and a method to call through the same node.
 * @type {{g: number, run: function(): string}}
 */
export const guarded = {
	get g() {
		return 1;
	},
	/**
	 * @returns {string} `"ran"`.
	 * @example
	 * guarded.run(); // "ran"
	 */
	run() {
		return "ran";
	}
};

/**
 * A plain data export.
 * @type {{p: number}}
 */
export const plain = { p: 1 };
