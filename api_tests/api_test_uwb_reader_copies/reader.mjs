/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_reader_copies/reader.mjs
 *	@Date: 2026-11-25T01:19:57-08:00 (1795598397)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:42:33-08:00 (1795599753)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that takes functions out of another module's descriptors and calls them later.
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Take the inspect hook of `self.store.data` and call it.
 * @returns {*} What the hook showed.
 */
export function inspectCopy() {
	const descriptor = Object.getOwnPropertyDescriptor(self.store.data, util.inspect.custom);
	if (!descriptor) return "none";
	return descriptor.value.call(self.store.data, 2, { stylize: (s) => s }, util.inspect);
}

/**
 * Take the getters of the array's accessor elements and call them.
 * @returns {Array<*>} What the getters read.
 */
export function accessorCopies() {
	const third = Object.getOwnPropertyDescriptor(self.store.list, 2);
	const fourth = Object.getOwnPropertyDescriptor(self.store.list, 3);
	const fifth = Object.getOwnPropertyDescriptor(self.store.list, 4);
	return [typeof third.get, third.get(), fourth.get(), fifth.get()];
}
