/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check/reader/reader.mjs
 *	@Date: 2026-11-08T16:45:23-08:00 (1794185123)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:30-08:00 (1794185790)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second module, reading the bag module's values through `self`, so what it reads comes as its own
 * views of them, and asking `self.slothlet.wrapped` about each.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Ask about the views this module gets of another module's values.
 * @returns {Record<string, boolean>} Each value's answer.
 */
export function checkViews() {
	const answers = {};
	const ask = (name, value) => {
		answers[name] = self.slothlet.wrapped(value);
	};
	ask("self.bag", self.bag);
	ask("self.bag.data", self.bag.data);
	ask("self.bag.data.list", self.bag.data.list);
	ask("self.bag.Thing", self.bag.Thing);
	ask("self.bag.Thing.prototype", self.bag.Thing.prototype);
	ask("self.bag.Thing.prototype.value", self.bag.Thing.prototype.value);
	ask("self.bag.makeThing", self.bag.makeThing);
	return answers;
}
