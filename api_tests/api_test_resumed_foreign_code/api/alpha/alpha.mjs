/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_resumed_foreign_code/api/alpha/alpha.mjs
 *	@Date: 2026-11-12T23:29:38-08:00 (1794554978)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:59:01-08:00 (1794556741)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out async functions reading the vault after an `await`: its helper's, and one
 * written in this file.
 * @module api_test_resumed_foreign_code.alpha
 * @memberof module:api_test_resumed_foreign_code
 */
import { self } from "@cldmv/slothlet/runtime";
import { readLater } from "../../helpers/later.mjs";

/**
 * The helper's async function, as it is.
 * @returns {function(): Promise<string>} The function.
 * @example
 * await (await api.alpha.giveLater())();
 */
export const giveLater = () => readLater;

/**
 * The helper's async function inside plain data.
 * @returns {{run: function(): Promise<string>}} The data.
 * @example
 * await (await api.alpha.boxLater()).run();
 */
export const boxLater = () => ({ run: readLater });

/**
 * An async function written in this file, inside plain data.
 * @returns {{run: function(): Promise<string>}} The data.
 * @example
 * await (await api.alpha.boxOwn()).run();
 */
export const boxOwn = () => ({
	run: async () => {
		await null;
		return self.vault.get();
	}
});
