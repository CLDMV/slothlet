/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_runtime_single/api/plain.mjs
 *	@Date: 2026-11-12T23:45:41-08:00 (1794555941)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:45:41-08:00 (1794555941)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module api file reading the vault through the runtime it imports.
 * @module api_test_runtime_single.plain
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault.
 * @returns {string} What the vault holds.
 * @example
 * api.plain.read(); // "SECRET"
 */
export const read = () => self.vault.get();
