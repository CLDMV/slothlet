/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /outside/hash.mjs
 *	@Date: 2026-11-08T14:29:34-08:00 (1794176974)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:42:09-08:00 (1794177729)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file of the `ext.b` module outside its api folder, reached through the `"imports"` of its helper's
 * package scope (`#outside`) (#717): slothlet does not load it under the instance's tag.
 * @module api_tests/api_test_host_record_leaf/module-scope/outside/hash
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
