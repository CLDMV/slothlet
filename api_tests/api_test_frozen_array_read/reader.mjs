/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_read/reader.mjs
 *	@Date: 2026-10-24T14:33:07-07:00 (1792877587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T14:56:21-07:00 (1792878981)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module reading another module's frozen arrays through `self`, as plain JS reads an array (#655).
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run `read`, reporting what it gave as JSON, or the error it threw.
 * @param {function(): *} read - The read.
 * @returns {string} The JSON of the value, or `"<name>: <message>"`.
 * @example
 * attempt(() => 1); // "1"
 */
function attempt(read) {
	try {
		return JSON.stringify(read());
	} catch (error) {
		return `${error?.name}: ${error?.message}`;
	}
}

/**
 * Read the store's frozen arrays every common way.
 * @returns {Record<string, string>} What each read gave.
 * @example
 * readAll();
 */
export function readAll() {
	return {
		index: attempt(() => self.store.list[0]),
		spread: attempt(() => [...self.store.list]),
		map: attempt(() => self.store.list.map((entry) => entry)),
		stringify: attempt(() => JSON.parse(JSON.stringify(self.store.list))),
		nestedIndex: attempt(() => self.store.data.list[1]),
		nestedSpread: attempt(() => [...self.store.data.list])
	};
}
