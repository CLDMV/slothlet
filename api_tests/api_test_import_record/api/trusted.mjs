/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_import_record/api/trusted.mjs
 *	@Date: 2026-11-12T01:13:22-08:00 (1794474802)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:34-08:00 (1794477394)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module allowed to read the vault. It imports no helper file.
 * @module api_test_import_record.trusted
 * @memberof module:api_test_import_record
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault.
 * @function read
 * @memberof module:api_test_import_record.trusted
 * @returns {string} What the vault holds.
 * @example
 * api.trusted.read(); // "SECRET"
 */
export const read = () => self.vault.get();
