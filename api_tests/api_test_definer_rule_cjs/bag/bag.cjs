/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule_cjs/bag/bag.cjs
 *	@Date: 2026-11-08T19:12:49-08:00 (1794193969)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:17:27-08:00 (1794194247)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS fixture for the definer rule (#726): a closure `bag` hands out, to tell two instances built
 * from this one file apart by its frames.
 * @module api_test_definer_rule_cjs.bag
 */
let self;
const ready = import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/** A closure: its definer is `bag.make` of the instance that loaded the file. */
exports.make = async () => {
	await ready;
	return () => self.vault.get();
};
