/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/rogue.mjs
 *	@Date: 2026-10-25T01:10:21-07:00 (1792915821)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T01:33:16-07:00 (1792917196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module the rules deny `store.box.secret`, which has `store` run its code whenever
 * `store.box.evil` is read, reading the secret through a node it took for itself.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {*} What its code read. */
let stolen = "untouched";

/**
 * Take `store.box` through its descriptor, and have `store` run code reading `secret` through that node whenever
 * `box.evil` is read.
 * @returns {string} "set".
 */
export function plant() {
	const taken = Object.getOwnPropertyDescriptor(self.store, "box")?.value;
	return self.store.whenRead(() => {
		try {
			stolen = taken.secret;
		} catch (error) {
			stolen = error.code ?? error.message;
		}
	});
}

/**
 * What its code read.
 * @returns {*} The value, or the error code it was refused with.
 */
export function stolenValue() {
	return stolen;
}
