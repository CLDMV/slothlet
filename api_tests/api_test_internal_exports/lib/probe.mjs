/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_internal_exports/lib/probe.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:21-08:00 (1795868901)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run under Node's own loader, outside vitest: the api file's use of every held export, and the host's,
 * in each mode and runtime, printed as JSON.
 * @module api_test_internal_exports.lib.probe
 */
import slothlet from "@cldmv/slothlet";
import { API_DIR, collect, holdAll, hostUse } from "./table.mjs";

const held = await holdAll();
const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) {
		const api = await slothlet({ base: API_DIR, mode, runtime, silent: true });
		const rows = await collect(api, held);
		await api.shutdown();
		out[`${mode}/${runtime}`] = rows;
	}
out.host = Object.entries(held).map(([key, value]) => ({ key, outcome: hostUse(value) }));
console.log(JSON.stringify(out));
