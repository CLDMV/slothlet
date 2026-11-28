/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_browser_readd/plug/p.mjs
 *	@Date: 2026-11-15T12:33:27-08:00 (1794774807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:34-08:00 (1795868854)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file mounted with `api.slothlet.api.add()` that counts each run of its top level.
 * @module api_test_browser_readd/plug/p
 */

globalThis.__readdBrowser = globalThis.__readdBrowser || {};
globalThis.__readdBrowser.p = (globalThis.__readdBrowser.p || 0) + 1;

/** The run of the top level this copy of the module is. */
const run = globalThis.__readdBrowser.p;

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
