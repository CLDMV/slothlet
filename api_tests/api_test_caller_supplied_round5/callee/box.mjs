/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/callee/box.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A getter the callee exports on an api object (#597): reading it runs the callee's code, as calling
 * the callee's function through `self` does.
 *
 * @module api_tests/api_test_caller_supplied_round5/callee/box
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The secret, read through a getter.
 * @type {{readonly value: string}}
 * @public
 * @example
 * api.callee.box.held.value; // "s3cret"
 */
export const held = {
	get value() {
		return self.vault.secret.secret();
	}
};
