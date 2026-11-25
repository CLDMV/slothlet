/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_own_members/api/gen.mjs
 *	@Date: 2026-11-25T02:40:36-08:00 (1795603236)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:30-08:00 (1795604370)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out generator objects carrying own members, open or closed to change.
 * @module api_test_generator_own_members/gen
 */

/**
 * Give a generator object its own members and close it as asked.
 * @param {Generator|AsyncGenerator} it - The generator object.
 * @param {"open"|"frozen"|"sealed"|"closed"} state - How far it is closed.
 * @returns {Generator|AsyncGenerator} The same generator object.
 */
function dress(it, state) {
	it.label = "mine";
	Object.defineProperty(it, "hidden", { value: 7, enumerable: false, writable: true, configurable: true });
	Object.defineProperty(it, "fixed", { value: "set", enumerable: true, writable: false, configurable: false });
	Object.defineProperty(it, "view", {
		get() {
			return `view:${it.label}`;
		},
		set(value) {
			it.label = value;
		},
		enumerable: true,
		configurable: true
	});
	if (state === "frozen") Object.freeze(it);
	if (state === "sealed") Object.seal(it);
	if (state === "closed") Object.preventExtensions(it);
	return it;
}

/**
 * A generator yielding its own `label`, then taking a new label from the step (unless it is frozen) and yielding its label.
 * @param {"open"|"frozen"|"sealed"|"closed"} state - How far it is closed.
 * @returns {Generator<string, string>} The generator object.
 */
export function make(state) {
	const it = (function* () {
		const given = yield it.label;
		if (given !== undefined && !Object.isFrozen(it)) it.label = given;
		yield it.label;
		return "end";
	})();
	return dress(it, state);
}

/**
 * The async twin of {@link make}.
 * @param {"open"|"frozen"|"sealed"|"closed"} state - How far it is closed.
 * @returns {AsyncGenerator<string, string>} The generator object.
 */
export function makeAsync(state) {
	const it = (async function* () {
		const given = yield it.label;
		if (given !== undefined && !Object.isFrozen(it)) it.label = given;
		yield it.label;
		return "end";
	})();
	return dress(it, state);
}
