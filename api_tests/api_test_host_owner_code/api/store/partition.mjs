/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/api/store/partition.mjs
 *	@Date: 2026-11-06T05:58:16-08:00 (1793973496)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T06:00:43-08:00 (1793973643)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A store module's leaf (#714), as rummage's `store.partition`: under the fixture's rules only the host's
 * record leaves may call it.
 * @module api_test_host_owner_code.store.partition
 */

/**
 * Open a partition.
 * @param {string} name - The partition's name.
 * @returns {string} The partition.
 */
export function partition(name) {
	return `p:${name}`;
}
