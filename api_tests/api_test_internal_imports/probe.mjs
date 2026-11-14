/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/probe.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run under Node's own loader, outside vitest: every load of {@link module:api_test_internal_imports.table},
 * in each mode and runtime, printed as JSON.
 * @module api_test_internal_imports.probe
 */
import slothlet from "@cldmv/slothlet";
import { API_DIR, REFUSED_DIR, collect } from "./table.mjs";

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) {
		const api = await slothlet({ base: API_DIR, mode, runtime, silent: true });
		const rows = await collect(api);
		await api.shutdown();
		let refused;
		try {
			const held = await slothlet({ base: REFUSED_DIR, mode, runtime, silent: true });
			try {
				refused = `loaded:${await held.held.kind()}`;
			} catch (error) {
				refused = error?.cause?.code ?? error?.code;
			} finally {
				await held.shutdown();
			}
		} catch (error) {
			refused = error?.cause?.code ?? error?.code;
		}
		out[`${mode}/${runtime}`] = { rows, refused };
	}
console.log(JSON.stringify(out));
