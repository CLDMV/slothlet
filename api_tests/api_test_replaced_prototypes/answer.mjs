/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_replaced_prototypes/answer.mjs
 *	@Date: 2026-11-17T13:23:01-08:00 (1794950581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:34:12-08:00 (1794951252)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An async leaf another module's replaced `Promise.prototype.then` tries to change the result of.
 */

/**
 * Answer after an await.
 * @returns {Promise<string>} The answer.
 */
export const fetch = async () => {
	await null;
	return "answer:real";
};
