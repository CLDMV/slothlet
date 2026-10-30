/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/supplier/bag.mjs
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
 * @fileoverview An object of the supplier's with a getter (#597): read by another module, the getter is still the
 * supplier's code.
 *
 * @module api_tests/api_test_caller_supplied_round2/supplier/bag
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * An object whose `value` getter calls the vault's secret.
 * @type {{readonly value: string}}
 * @public
 * @example
 * api.supplier.bag.box.value; // refused: the supplier may not call the secret
 */
export const box = {
	get value() {
		return self.vault.secret.secret();
	}
};
