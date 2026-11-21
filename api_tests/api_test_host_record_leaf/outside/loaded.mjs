/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/outside/loaded.mjs
 *	@Date: 2026-11-08T14:29:34-08:00 (1794176974)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:42:10-08:00 (1794177730)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file of the `ext.b` module outside its api folder, which it loads through `load-pkg` (#717): the
 * package's `import()` loads it, not slothlet.
 * @module api_tests/api_test_host_record_leaf/outside/loaded
 */

/**
 * Open a store partition.
 * @param {object} store - The store node.
 * @returns {string} The partition.
 * @example
 * open(self.store); // "p:ext.b.work"
 */
export function open(store) {
	return store.partition();
}
