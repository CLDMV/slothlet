/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/fixtures/native-import.cjs
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
 * @fileoverview A CommonJS file, so that Node itself loads it and resolves what it imports.
 */

/**
 * Import a module with Node's own loader.
 * @param {string} specifier - The specifier.
 * @returns {Promise<object>} The module's namespace.
 * @example
 * await nativeImport("@cldmv/slothlet/runtime");
 */
module.exports = (specifier) => import(specifier);
