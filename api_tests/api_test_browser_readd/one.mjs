/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_readd/one.mjs
 *	@Date: 2026-11-15T17:09:19-08:00 (1794791359)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:41:53-08:00 (1794796913)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file mounted with `api.slothlet.api.add()` that counts each run of its top level.
 * @module api_test_browser_readd/one
 */

globalThis.__readdBrowser = globalThis.__readdBrowser || {};
globalThis.__readdBrowser.one = (globalThis.__readdBrowser.one || 0) + 1;

/** The run of the top level this copy of the module is. */
const run = globalThis.__readdBrowser.one;

/**
 * Which run of the file's top level this copy is.
 * @returns {number} The run.
 */
export function ping() {
	return run;
}

/**
 * The URL this copy was imported from.
 * @returns {string} `import.meta.url`.
 */
export function where() {
	return import.meta.url;
}
