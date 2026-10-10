/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_slot_default/store/store.mjs
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
 * @fileoverview Fixture: a folder's same-named file default-exports a class instance with a private
 * field, beside a sibling file, so the folder composes as the instance.
 * @module api_smart_flatten_slot_default.store.store
 */

class Store {
	#items = ["a"];
	add(item) {
		this.#items.push(item);
		return this.#items.length;
	}
	get size() {
		return this.#items.length;
	}
}

export default new Store();

/**
 * A named export composed beside the instance.
 * @returns {string} "store.extra".
 */
export function extra() {
	return "store.extra";
}
