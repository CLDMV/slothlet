/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_import_record/api/vault.mjs
 *	@Date: 2026-11-12T01:13:22-08:00 (1794474802)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:35-08:00 (1794477395)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: the module one rule set denies `guest`.
 * @module api_test_import_record.vault
 * @memberof module:api_test_import_record
 */

/**
 * What the vault holds.
 * @function get
 * @memberof module:api_test_import_record.vault
 * @returns {string} "SECRET".
 * @example
 * api.vault.get(); // "SECRET"
 */
export const get = () => "SECRET";
