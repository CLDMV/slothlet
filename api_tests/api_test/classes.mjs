/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/classes.mjs
 *	@Date: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Class-export fixtures for testing slothlet's `construct` proxy trap.
 * Verifies that `new api.classes.Counter(n)` correctly runs the constructor and
 * returns an instance with a working prototype chain — not a silent empty object.
 * @module api_test.classes
 * @memberof module:api_test
 */

/**
 * A simple counter class used to verify the `construct` proxy trap.
 * @class Counter
 * @memberof module:api_test.classes
 */
export class Counter {
	/**
	 * @param {number} start - Initial counter value.
	 */
	constructor(start) {
		this.value = start;
	}

	/**
	 * Increments the counter by 1 and returns the new value.
	 * @returns {number} Updated counter value.
	 * @example
	 * const c = new Counter(0);
	 * c.increment(); // 1
	 */
	increment() {
		this.value += 1;
		return this.value;
	}

	/**
	 * Returns the current value.
	 * @returns {number} Current counter value.
	 * @example
	 * const c = new Counter(5);
	 * c.get(); // 5
	 */
	get() {
		return this.value;
	}
}

/**
 * A class with a private field to verify that private class fields are
 * preserved when the construct trap returns the raw instance (not re-proxied).
 * @class Secrets
 * @memberof module:api_test.classes
 */
export class Secrets {
	#token;

	/**
	 * @param {string} token - Secret token stored as a private field.
	 */
	constructor(token) {
		this.#token = token;
	}

	/**
	 * Returns the private token.
	 * @returns {string} The stored token.
	 * @example
	 * const s = new Secrets("abc");
	 * s.reveal(); // "abc"
	 */
	reveal() {
		return this.#token;
	}
}
