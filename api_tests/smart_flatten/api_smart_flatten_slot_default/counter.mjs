/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_slot_default/counter.mjs
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
 * @fileoverview Fixture: a class-instance default with a private field, plus a named export. Its methods
 * and getter reach `#count`, which only the instance itself has.
 * @module api_smart_flatten_slot_default.counter
 */

class Counter {
	#count = 0;
	inc() {
		this.#count += 1;
		return this.#count;
	}
	get value() {
		return this.#count;
	}
}

export default new Counter();

/**
 * A named export composed beside the instance.
 * @returns {string} "counter.extra".
 */
export function extra() {
	return "counter.extra";
}
