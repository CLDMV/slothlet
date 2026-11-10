/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/api/store.mjs
 *	@Date: 2026-11-08T12:12:14-08:00 (1794168734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:29:59-08:00 (1794169799)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The guarded target of the host record leaf tests (#717): only `host.records.**` (and the same leaves
 * mounted at `records.host.**`) may open a partition.
 * @module api_tests/api_test_host_record_leaf/store
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Open a partition, naming the call it was opened for.
 * @returns {string} `p:<caller's api path>`.
 * @example
 * api.store.partition(); // "p:host.records.apply"
 */
export function partition() {
	return `p:${self.slothlet.metadata.caller()?.apiPath ?? null}`;
}
