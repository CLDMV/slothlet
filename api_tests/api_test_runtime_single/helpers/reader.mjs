/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_runtime_single/helpers/reader.mjs
 *	@Date: 2026-11-12T22:54:52-08:00 (1794552892)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:54:52-08:00 (1794552892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file the CommonJS api file `native.cjs` loads with `import()`.
 * @module api_test_runtime_single.helpers.reader
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault.
 * @returns {string} What the vault holds.
 * @example
 * read(); // "SECRET"
 */
export const read = () => self.vault.get();
