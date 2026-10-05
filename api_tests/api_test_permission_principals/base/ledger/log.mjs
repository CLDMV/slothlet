/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_principals/base/ledger/log.mjs
 *	@Date: 2026-09-26T22:19:45-07:00 (1790486385)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:40-07:00 (1791090880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

const entries = [];

/**
 * Record a ledger entry. Rules allow only the roles plugin to call it, so a successful record
 * proves a resolver ran as the module that registered it (#459).
 * @param {string} entry - Entry to record.
 * @returns {number} Number of recorded entries.
 */
export const record = (entry) => entries.push(entry);

/**
 * Recorded entries.
 * @returns {string[]} A copy of the entries.
 */
export const list = () => [...entries];
