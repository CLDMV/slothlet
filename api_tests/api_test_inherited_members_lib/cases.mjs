/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members_lib/cases.mjs
 *	@Date: 2026-11-04T21:15:39-08:00 (1793855739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:25:42-08:00 (1793859942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared cases for the inherited-member tests (#630). The same calls run on an api node and on the
 * plain value the module exported, from the host and from module code, and their outcomes are compared.
 * @module api_test_inherited_members_lib/cases
 */

/* eslint-disable no-prototype-builtins -- these cases call the inherited members on the subject itself, which is what they test (#630). */

/** Members every object inherits from `Object.prototype`. */
export const OBJECT_MEMBERS = [
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toString",
	"toLocaleString",
	"valueOf",
	"__lookupGetter__",
	"__lookupSetter__",
	"__defineGetter__",
	"__defineSetter__",
	"constructor",
	"__proto__"
];

/** Members every function inherits from `Function.prototype`, or holds itself. */
export const FUNCTION_MEMBERS = ["call", "apply", "bind", "toString", "length", "name"];

const LABELS = new Map([
	[Object, "Object"],
	[Function, "Function"],
	[Object.prototype, "Object.prototype"],
	[Function.prototype, "Function.prototype"]
]);

/**
 * Describe a result so a node's and a plain value's can be compared.
 * @param {*} subject - The node or plain value the call was made on.
 * @param {*} value - The result.
 * @returns {*} A comparable description.
 */
function describe(subject, value) {
	if (Array.isArray(value)) return value.map((item) => describe(subject, item));
	if (value === subject) return "<itself>";
	if (LABELS.has(value)) return LABELS.get(value);
	if (typeof value === "function") return "function";
	if (value !== null && typeof value === "object") return "object";
	return value;
}

/**
 * Make one member's call.
 * @param {object|Function} subject - Node or plain value.
 * @param {string} member - Member name.
 * @param {string} ownKey - A key the subject holds as its own.
 * @returns {*} The call's result.
 */
function call(subject, member, ownKey) {
	switch (member) {
		case "hasOwnProperty":
			return [subject.hasOwnProperty(ownKey), subject.hasOwnProperty("missing"), subject.hasOwnProperty("hasOwnProperty")];
		case "isPrototypeOf":
			return [subject.isPrototypeOf(Object.create(subject)), subject.isPrototypeOf({})];
		case "propertyIsEnumerable":
			return [subject.propertyIsEnumerable(ownKey), subject.propertyIsEnumerable("hasOwnProperty")];
		case "toString":
			return subject.toString();
		case "toLocaleString":
			return subject.toLocaleString();
		case "valueOf":
			return subject.valueOf();
		case "__lookupGetter__":
			return [subject.__lookupGetter__(ownKey), subject.__lookupGetter__("missing")];
		case "__lookupSetter__":
			return [subject.__lookupSetter__(ownKey), subject.__lookupSetter__("missing")];
		case "__defineGetter__": {
			const returned = subject.__defineGetter__("definedGetter", () => 42);
			return [returned, subject.definedGetter, typeof subject.__lookupGetter__("definedGetter")];
		}
		case "__defineSetter__": {
			let seen;
			const returned = subject.__defineSetter__("definedSetter", (value) => {
				seen = value;
			});
			subject.definedSetter = 5;
			return [returned, seen, typeof subject.__lookupSetter__("definedSetter")];
		}
		case "constructor":
			return subject.constructor;
		case "__proto__":
			return subject.__proto__;
		case "call":
			return subject.call(null, "a", "b");
		case "apply":
			return subject.apply(null, ["a", "b"]);
		case "bind":
			return subject.bind(null, "a")("b");
		case "length":
			return subject.length;
		case "name":
			return subject.name;
		default:
			throw new Error(`no case for ${member}`);
	}
}

/**
 * Run every inherited member's call on `subject`, then read back its keys.
 * @param {object|Function} subject - Node or plain value.
 * @param {string} ownKey - A key the subject holds as its own.
 * @returns {{outcomes: Object<string, *>, keys: string[], forIn: string[]}} What each call gave (or the error it
 *   threw), and the keys `Object.keys` and `for…in` list afterwards, sorted.
 */
export function exercise(subject, ownKey) {
	const members = typeof subject === "function" ? [...OBJECT_MEMBERS, ...FUNCTION_MEMBERS] : OBJECT_MEMBERS;
	const outcomes = {};
	for (const member of members) {
		const label = typeof subject === "function" && FUNCTION_MEMBERS.includes(member) ? `fn.${member}` : member;
		try {
			outcomes[label] = describe(subject, call(subject, member, ownKey));
		} catch (error) {
			outcomes[label] = `threw ${error?.name}: ${error?.code ?? error?.message}`;
		}
	}
	const forIn = [];
	for (const key in subject) forIn.push(key);
	// Compared as sets: which keys are listed is what this checks, not their order.
	return { outcomes, keys: Object.keys(subject).sort(), forIn: forIn.sort() };
}

/**
 * Call the exports named like `Object.prototype` members.
 * @param {object} api - The api root (`api` or `self`).
 * @returns {Object<string, *>} Each call's result, or the error it threw.
 */
export function shadowed(api) {
	const attempt = (fn) => {
		try {
			return fn();
		} catch (error) {
			return `threw ${error?.name}: ${error?.code ?? error?.message}`;
		}
	};
	return {
		toString: attempt(() => api.shadow.toString()),
		valueOf: attempt(() => api.shadow.valueOf()),
		hasOwnProperty: attempt(() => api.shadow.hasOwnProperty()),
		dirValueOf: attempt(() => api.shadowdir.valueOf()),
		dirToString: attempt(() => api.shadowdir.toString()),
		shadowKeys: Object.keys(api.shadow).sort(),
		dirKeys: Object.keys(api.shadowdir).sort()
	};
}
