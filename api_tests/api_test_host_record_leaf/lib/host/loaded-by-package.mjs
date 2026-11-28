/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_host_record_leaf/lib/host/loaded-by-package.mjs
 *	@Date: 2026-11-08T14:37:40-08:00 (1794177460)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:17-08:00 (1795868897)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file of the host's that the host loads through `load-pkg`, a package `ext.b` imports too (#717): its
 * recorded importer is the package, which a module loaded.
 * @module api_tests/api_test_host_record_leaf/lib/host/loaded-by-package
 */

/**
 * Open a store partition.
 * @param {object} store - The store node.
 * @returns {string} The partition.
 * @example
 * open(api.store); // "p:host.records.loaded.open"
 */
export function open(store) {
	return store.partition();
}
