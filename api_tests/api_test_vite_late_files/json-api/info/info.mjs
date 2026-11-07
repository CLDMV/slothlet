/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/json-api/info/info.mjs
 *	@Date: 2026-11-06T20:23:50-08:00 (1794025430)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T20:28:57-08:00 (1794025737)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that imports its package's manifest as JSON (#714), as rummage's extensions import their
 * `package.json`: under Node and under vitest with the `slothletInstanceImports()` plugin, the leaf loads and reads it.
 * @module api_test_vite_late_files.json-api.info
 */
import manifest from "../../manifest.json" with { type: "json" };

/**
 * The manifest's name.
 * @returns {string} The name.
 */
export function name() {
	return manifest.name;
}
