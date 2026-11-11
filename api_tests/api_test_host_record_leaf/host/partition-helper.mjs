/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/host/partition-helper.mjs
 *	@Date: 2026-11-08T12:12:14-08:00 (1794168734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:30:00-08:00 (1794169800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper in another of the host's files (#717): the host record leaves open a partition through it.
 * @module api_tests/api_test_host_record_leaf/host/partition-helper
 */

/**
 * Open a store partition with the host's api.
 * @param {() => object} getApi - The host's api.
 * @returns {string} The partition.
 * @example
 * openPartition(() => api); // "p:host.records.apply"
 */
export function openPartition(getApi) {
	return getApi().store.partition();
}
