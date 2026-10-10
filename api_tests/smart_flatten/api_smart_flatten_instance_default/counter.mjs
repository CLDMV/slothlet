/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_instance_default/counter.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#587 review): class-instance default plus a named export (counter.mjs).
 * @module smart_flatten.api_smart_flatten_instance_default.counter
 */

/**
 * A class-instance default: its methods live on the prototype and `size` is a getter, so a copy that
 * keeps neither (an object spread) loses them.
 */
class Store {
	constructor() {
		this.items = ["a", "b"];
	}
	/**
	 * @param {string} item - Item to add.
	 * @returns {number} The new item count.
	 */
	add(item) {
		this.items.push(item);
		return this.items.length;
	}
	/** @returns {number} Item count through the prototype. */
	count() {
		return this.items.length;
	}
	/** @returns {number} Item count through a getter. */
	get size() {
		return this.items.length;
	}
}

export default new Store();

/** @returns {string} A named export merged onto the default. */
export function label() {
	return "named-label";
}
