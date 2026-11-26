/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_own_members/lib/exercise.mjs
 *	@Date: 2026-11-25T02:34:03-08:00 (1795602843)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:31-08:00 (1795604371)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What ordinary code sees of a generator object and its steps. Used by the reader module and by the
 * test's plain-JS twin alike, so both answer through the same code.
 * @module api_test_generator_own_members/lib/exercise
 */

/**
 * Run a check, answering what it returned or the name of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer.
 */
const answer = (check) => {
	try {
		return check();
	} catch (error) {
		return { threw: error?.name ?? String(error) };
	}
};

/**
 * The generator object's own members and how far it is closed.
 * @param {object} it - The generator object.
 * @returns {object} The description.
 */
export function describe(it) {
	const own = Reflect.ownKeys(it).map(String);
	return {
		keys: Object.keys(it),
		own,
		enumerable: own.map((key) => Object.getOwnPropertyDescriptor(it, key).enumerable),
		kinds: own.map((key) => ("value" in Object.getOwnPropertyDescriptor(it, key) ? "data" : "accessor")),
		writable: own.map((key) => Object.getOwnPropertyDescriptor(it, key).writable),
		configurable: own.map((key) => Object.getOwnPropertyDescriptor(it, key).configurable),
		label: it.label,
		hidden: it.hidden,
		fixed: it.fixed,
		view: it.view,
		frozen: Object.isFrozen(it),
		sealed: Object.isSealed(it),
		extensible: Object.isExtensible(it)
	};
}

/**
 * Write the generator object's members and step it: a write before a step reaches the generator's body, and a write
 * its body makes is seen after the step.
 * @param {Generator} it - The generator object.
 * @returns {Array<*>} What each write and step answered.
 */
export function exercise(it) {
	return [
		answer(() => {
			it.label = "written";
			return it.label;
		}),
		answer(() => {
			it.added = 1;
			return it.added;
		}),
		it.next().value,
		it.next("moved").value,
		it.label,
		answer(() => {
			it.view = "through";
			return [it.view, it.label];
		}),
		it.next().done
	];
}

/**
 * The async twin of {@link exercise}.
 * @param {AsyncGenerator} it - The generator object.
 * @returns {Promise<Array<*>>} What each write and step answered.
 */
export async function exerciseAsync(it) {
	return [
		answer(() => {
			it.label = "written";
			return it.label;
		}),
		answer(() => {
			it.added = 1;
			return it.added;
		}),
		(await it.next()).value,
		(await it.next("moved")).value,
		it.label,
		answer(() => {
			it.view = "through";
			return [it.view, it.label];
		}),
		(await it.next()).done
	];
}
