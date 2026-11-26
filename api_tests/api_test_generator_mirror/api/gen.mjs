/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_mirror/api/gen.mjs
 *	@Date: 2026-11-25T07:53:47-08:00 (1795622027)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T08:36:16-08:00 (1795624576)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out generator objects and keeps changing their own members afterwards: from the
 * generator's own steps, from a call holding the generator in a closure, and from a call it is handed back to.
 * @module api_test_generator_mirror/gen
 */

import { act, inside } from "../lib/act.mjs";

/**
 * The generator object a call of {@link keep} made, held for {@link change}.
 * @type {Generator|AsyncGenerator|null}
 */
let kept = null;

/**
 * Give a generator object its own members: an enumerable and a non-enumerable writable one, a fixed one and an accessor.
 * @param {Generator|AsyncGenerator} it - The generator object.
 * @returns {Generator|AsyncGenerator} The same generator object.
 */
function dress(it) {
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
	return it;
}

/**
 * A generator that answers each step with what it sees of itself, after carrying out the command the step gave it.
 * @param {boolean} isAsync - Whether to make an async generator.
 * @returns {Generator|AsyncGenerator} The generator object, open to change.
 */
export function make(isAsync) {
	const it = isAsync
		? (async function* () {
				let command = yield inside(it);
				for (;;) command = yield act(it, command);
			})()
		: (function* () {
				let command = yield inside(it);
				for (;;) command = yield act(it, command);
			})();
	return dress(it);
}

/**
 * Make a generator object and keep it, or hand out the one kept already.
 * @param {boolean} isAsync - Whether to make an async generator.
 * @returns {Generator|AsyncGenerator} The kept generator object.
 */
export function keep(isAsync) {
	if (!kept) kept = make(isAsync);
	return kept;
}

/**
 * Carry out a command on the kept generator object, which the caller is not handing in.
 * @param {string} command - The command.
 * @returns {object} What this module sees of it afterwards.
 */
export function change(command) {
	return act(kept, command);
}

/**
 * Carry out a command on a generator object the caller hands in.
 * @param {Generator|AsyncGenerator} it - The generator object.
 * @param {string} command - The command.
 * @returns {object} What this module sees of it afterwards.
 */
export function alter(it, command) {
	return act(it, command);
}

/**
 * Whether a generator object handed in is the one kept.
 * @param {Generator|AsyncGenerator} it - The generator object.
 * @returns {boolean} True when it is.
 */
export function isKept(it) {
	return it === kept;
}
