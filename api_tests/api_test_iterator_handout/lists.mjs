/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_iterator_handout/lists.mjs
 *	@Date: 2026-11-06T18:32:39-08:00 (1794018759)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T18:33:52-08:00 (1794018832)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Iterators of the language's own a module hands out: the iterator of an array (directly, from `entries()`, and as a
 * list class's own `Symbol.iterator` returns it, the way a DOM `NodeList` does), the one `matchAll` returns, and an
 * iterator helper.
 */

/** A list whose iterator is its array's, as a DOM `NodeList`'s is. */
class ItemList {
	constructor(items) {
		this.items = items;
	}
	get length() {
		return this.items.length;
	}
	item(index) {
		return this.items[index] ?? null;
	}
	[Symbol.iterator]() {
		return this.items[Symbol.iterator]();
	}
}

/**
 * A list holding plain objects, iterated through its array's iterator.
 * @returns {ItemList} The list.
 */
export function nodeList() {
	return new ItemList([{ name: "a" }, { name: "b" }]);
}

/**
 * The iterator of an array of the module's functions.
 * @returns {Iterator<Function>} The iterator.
 */
export function arrayIterator() {
	return [() => "one", () => "two"][Symbol.iterator]();
}

/**
 * The iterator `entries()` returns.
 * @returns {Iterator<[number, string]>} The iterator.
 */
export function entries() {
	return ["x", "y"].entries();
}

/**
 * The iterator `matchAll` returns.
 * @returns {Iterator<RegExpMatchArray>} The iterator.
 */
export function matches() {
	return "a1b2".matchAll(/\d/g);
}

/**
 * An iterator helper mapping an array's values with the module's function, where the engine has them.
 * @returns {Iterator<number>|null} The iterator, or null.
 */
export function mapped() {
	const values = [1, 2].values();
	return typeof values.map === "function" ? values.map((n) => n * 10) : null;
}
