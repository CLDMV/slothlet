/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/base/keeper/box.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module allowed the vault's secret that exposes it through a getter (#597): read by the host, the
 * getter runs as this module.
 *
 * @module api_tests/api_test_caller_supplied_round2/base/keeper/box
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The secret, read through a getter.
 * @type {{readonly value: string}}
 * @public
 * @example
 * api.keeper.box.held.value; // "s3cret"
 */
export const held = {
	get value() {
		return self.vault.secret.secret();
	}
};
