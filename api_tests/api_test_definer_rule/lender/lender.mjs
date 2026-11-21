/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/lender/lender.mjs
 *	@Date: 2026-11-08T22:40:29-08:00 (1794206429)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T22:58:00-08:00 (1794207480)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): a module no rule lets read the vault, returning a thenable whose
 * `then` reads it. Whoever awaits the thenable, its `then` runs as `lender.thenable`.
 * @module api_test_definer_rule.lender
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * A thenable whose `then` reads the vault.
 * @returns {{then: function(function, function): void}} The thenable.
 * @example
 * await api.lender.thenable(); // refused: lender may not read the vault
 */
export const thenable = () => ({
	then(resolve, reject) {
		try {
			resolve(self.vault.get());
		} catch (error) {
			reject(error);
		}
	}
});
