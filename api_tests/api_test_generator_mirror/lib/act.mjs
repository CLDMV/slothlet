/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_mirror/lib/act.mjs
 *	@Date: 2026-11-25T07:53:47-08:00 (1795622027)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T08:36:17-08:00 (1795624577)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Commands a module carries out on its generator objects, and what code sees of a generator object's
 * own members. Used by the module, by the reader and by the test's plain-JS twin alike, so each answers through the
 * same code.
 * @module api_test_generator_mirror/lib/act
 */

/**
 * Run a check, answering what it returned or the name of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer.
 */
export function attempt(check) {
	try {
		return { gave: check() };
	} catch (error) {
		return { threw: error?.name ?? String(error) };
	}
}

/**
 * A member's value as a description can hold it.
 * @param {*} value - The value.
 * @returns {*} The value, or its type for code and objects.
 */
const shown = (value) => (value !== null && (typeof value === "object" || typeof value === "function") ? `<${typeof value}>` : value);

/**
 * What code sees of a generator object's own members and how far it is closed.
 * @param {object} it - The generator object.
 * @returns {object} The description.
 */
export function inside(it) {
	const own = Reflect.ownKeys(it).map(String);
	const descriptors = Reflect.ownKeys(it).map((key) => {
		const descriptor = Object.getOwnPropertyDescriptor(it, key);
		return {
			kind: "value" in descriptor ? "data" : "accessor",
			value: shown(descriptor.value),
			get: typeof descriptor.get,
			set: typeof descriptor.set,
			writable: descriptor.writable,
			enumerable: descriptor.enumerable,
			configurable: descriptor.configurable
		};
	});
	return {
		own,
		keys: Object.keys(it),
		descriptors,
		values: own.map((key) => attempt(() => shown(it[key]))),
		json: JSON.stringify(it),
		frozen: Object.isFrozen(it),
		sealed: Object.isSealed(it),
		extensible: Object.isExtensible(it)
	};
}

/**
 * Carry out a command on a generator object.
 * @param {object} it - The generator object.
 * @param {string} command - The command.
 * @returns {object} What is seen of it afterwards.
 */
export function act(it, command) {
	const answer = attempt(() => {
		switch (command) {
			case "add":
				it.late = "late";
				return it.late;
			case "relabel":
				it.label = "moved";
				return it.label;
			case "reorder":
				delete it.label;
				it.label = "again";
				return Reflect.ownKeys(it).map(String);
			case "redefine":
				Object.defineProperty(it, "hidden", { value: 8, writable: false });
				return it.hidden;
			case "drop":
				return delete it.hidden;
			case "freeze":
				Object.freeze(it);
				return Object.isFrozen(it);
			case "seal":
				Object.seal(it);
				return Object.isSealed(it);
			case "prevent":
				Object.preventExtensions(it);
				return Object.isExtensible(it);
			default:
				return undefined;
		}
	});
	return { command, answer, seen: inside(it) };
}
