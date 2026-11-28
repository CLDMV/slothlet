/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_same/checker.mjs
 *	@Date: 2026-11-25T01:28:37-08:00 (1795598917)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:03-08:00 (1795869003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module comparing what `self` hands it with what it holds.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Compare views of the store's values.
 * @returns {object} What `same` answered.
 */
export function compare() {
	const promise = self.store.later();
	const instance = self.store.make();
	return {
		data: self.slothlet.same(self.store.data, self.store.data),
		promise: self.slothlet.same(promise, promise),
		instance: self.slothlet.same(instance, instance),
		proto: self.slothlet.same(Object.getPrototypeOf(instance), self.store.Box.prototype),
		different: self.slothlet.same(self.store.data, instance)
	};
}
