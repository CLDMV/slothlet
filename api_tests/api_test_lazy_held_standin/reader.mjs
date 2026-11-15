/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_held_standin/reader.mjs
 *	@Date: 2026-11-15T08:35:27-08:00 (1794760527)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:39:01-08:00 (1794775141)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/** What this module read of `d` before the folder loaded, by member name. */
const held = {};

/**
 * Read a member of `d` through `self` and keep what the read gave.
 * @param {string} key - The member's name.
 * @returns {boolean} True.
 */
export function take(key) {
	held[key] = self.d[key];
	return true;
}

/**
 * Wait for `d` to load.
 * @returns {Promise<boolean>} True.
 */
export async function settle() {
	await self.d;
	return true;
}

/**
 * What the kept member answers now, the same questions the test asks of a value.
 * @param {string} key - The member's name.
 * @param {boolean} [fresh=false] - Read the member again instead of using the kept one.
 * @returns {object} The answers.
 */
export function ask(key, fresh = false) {
	const node = fresh ? self.d[key] : held[key];
	const answer = (check) => {
		try {
			return check();
		} catch (error) {
			return { threw: error?.code ?? error?.name ?? "threw" };
		}
	};
	return {
		proto: answer(() => {
			const proto = Object.getPrototypeOf(node);
			return proto === null ? null : proto.constructor.name;
		}),
		map: answer(() => node instanceof Map),
		set: answer(() => node instanceof Set),
		date: answer(() => node instanceof Date),
		error: answer(() => node instanceof Error),
		array: answer(() => node instanceof Array),
		keys: answer(() => Object.keys(node)),
		has: answer(() => "a" in Object(node)),
		value: answer(() => {
			if (node instanceof Map) return [node.get("k"), node.size, [...node]];
			if (node instanceof Set) return [node.has("s"), node.size, [...node]];
			if (node instanceof Date) return node.getTime();
			if (node instanceof Error) return node.message;
			if (node instanceof Array) return [node[0], node.length, [...node]];
			const proto = Object.getPrototypeOf(Object(node));
			if (proto === String.prototype || proto === Number.prototype) return [`${node}`, node.length];
			if (proto === Function.prototype) return [node.name, node.length];
			return [node.a, node.b, node.f()];
		})
	};
}

/**
 * The own keys of a member of `d` (or of `d` itself), and its descriptions of `length` and `name`.
 * @param {string} [key] - The member's name; none for `d`.
 * @returns {{keys: string[], length: object|undefined, name: object|undefined}} What it lists.
 */
export function own(key) {
	const node = key ? self.d[key] : self.d;
	const describe = (prop) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(node, prop);
		return descriptor && { value: descriptor.value, enumerable: descriptor.enumerable };
	};
	return { keys: Reflect.ownKeys(node).map(String), length: describe("length"), name: describe("name") };
}
