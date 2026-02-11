/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/lib/header-config.mjs
 *	@Date: 2026-02-05T06:45:03-08:00 (1770302703)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:01:59 -08:00 (1770775319)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Shared configuration for file header validation and fixing
 * Used by both analyze-errors.mjs and fix-headers.mjs
 */

/**
 * Configuration for file header check folders
 * @type {Array<{path: string, recursive: boolean}>}
 */
export const FILE_HEADER_CHECK_FOLDERS = [
	{ path: ".", recursive: false }, // Root folder only (non-recursive)
	{ path: "tools", recursive: true }, // tools/ folder (recursive)
	{ path: "tests", recursive: true }, // tests/ folder (recursive)
	{ path: "api_tests", recursive: true } // api_tests/ folder (recursive)
];

/**
 * Folders/files to ignore when checking file headers
 * @type {string[]}
 */
export const FILE_HEADER_IGNORE_FOLDERS = [
	"tests/vitests_v2", // Ignore tests/vitests_v2
	"tools/fix-headers.mjs" // Ignore fix-headers.mjs (self-exclusion)
];
