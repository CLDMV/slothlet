/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_root_listing/objroot/open.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lists and reads the api through `self`: at the root and at the same members mounted one level down.
 * @module api_test_api_root_listing/open
 */

import { self } from "@cldmv/slothlet/runtime";

/** The `self` this file read at its top level, kept for later calls. */
const kept = self;

/** Every member name the fixture's files make, for `in` and descriptors. */
const NAMES = [
	"folder",
	"file",
	"fn",
	"dobj",
	"pnum",
	"pstr",
	"pbool",
	"pnull",
	"pundef",
	"pbig",
	"psym",
	"rnum",
	"rstr",
	"rbool",
	"rnull",
	"rundef",
	"rbig",
	"rsym",
	"rdata",
	"rfn",
	"reader",
	"open"
];

/**
 * The node at a dotted path, from a root.
 * @param {object} root - Where to start.
 * @param {string} path - The path; empty for the root.
 * @returns {*} The node.
 */
function at(root, path) {
	let node = root;
	for (const segment of path ? path.split(".") : []) node = node[segment];
	return node;
}

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * A value as a comparable description.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (typeof value === "bigint" || typeof value === "symbol") return { [typeof value]: String(value) };
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	return { [typeof value]: true };
}

/**
 * The api members a listing gives: the fixture's own names, without slothlet's members of the root, the mount, or a
 * function's own `length`, `name` and `prototype`.
 * @param {Array<string|symbol>} names - The listing.
 * @returns {string[]} The member names.
 */
const members = (names) => names.filter((name) => NAMES.includes(name));

/**
 * Every way plain JavaScript lists an object, applied to the node at a path.
 * @param {string} path - The path; empty for the root.
 * @param {"self"|"kept"|"api"} [via="self"] - Through `self`, the `self` kept at load, or `self.slothlet.diag.api()`.
 * @returns {object} The listings.
 */
export function list(path, via = "self") {
	const root = via === "kept" ? kept : via === "api" ? self.slothlet.diag.api() : self;
	const node = at(root, path);
	return {
		keys: answer(() => members(Object.keys(node))),
		ownKeys: answer(() => members(Reflect.ownKeys(node)).sort()),
		names: answer(() => members(Object.getOwnPropertyNames(node)).sort()),
		descriptors: answer(() => members(Object.keys(Object.getOwnPropertyDescriptors(node))).sort()),
		forIn: answer(() => {
			const found = [];
			for (const key in node) found.push(key);
			return members(found);
		}),
		spread: answer(() => members(Object.keys({ ...node }))),
		entries: answer(() =>
			Object.entries(node)
				.filter(([key]) => members([key]).length)
				.map(([key, value]) => [key, described(value)])
		),
		values: answer(
			() =>
				Object.entries(node).filter(([key]) => members([key]).length).length ===
				Object.values(node).length - (Object.keys(node).length - members(Object.keys(node)).length)
		),
		json: answer(() => {
			const copy = {};
			for (const [key, value] of Object.entries(node)) if (members([key]).length) copy[key] = value;
			return JSON.stringify(copy, (key, value) => (typeof value === "bigint" ? String(value) : value));
		}),
		has: answer(() => NAMES.filter((name) => name in node)),
		described: answer(() => NAMES.filter((name) => Object.getOwnPropertyDescriptor(node, name) !== undefined)),
		describedValues: answer(() =>
			NAMES.filter((name) => Object.getOwnPropertyDescriptor(node, name) !== undefined).map((name) =>
				described(Object.getOwnPropertyDescriptor(node, name).value)
			)
		)
	};
}

/**
 * Read the member at a path.
 * @param {string} path - The path.
 * @param {"self"|"kept"|"api"} [via="self"] - The root to read from.
 * @returns {*} Its description, or `{ threw }`.
 */
export function read(path, via = "self") {
	const root = via === "kept" ? kept : via === "api" ? self.slothlet.diag.api() : self;
	return answer(() => described(at(root, path)));
}

/**
 * Await the member at a path.
 * @param {string} path - The path.
 * @returns {Promise<*>} What awaiting it gave, or `{ threw }`.
 */
export async function settle(path) {
	try {
		return described(await at(self, path));
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * What `self.slothlet.diag.describe()` lists, and what `describe(true)` hands over, for the member names.
 * @returns {object} Both.
 */
export function describe() {
	return {
		keys: answer(() => members(self.slothlet.diag.describe())),
		all: answer(() => {
			const all = self.slothlet.diag.describe(true);
			return Object.keys(all)
				.filter((key) => members([key]).length)
				.map((key) => [key, described(all[key])]);
		})
	};
}
