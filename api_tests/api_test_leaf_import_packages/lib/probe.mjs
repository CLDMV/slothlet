/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_import_packages/lib/probe.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T00:00:00-08:00 (1795507200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the package leaf-import cases under Node's own loader, in every mode and runtime, and writes
 * each case's outcome as JSON: `{ code }` for a refusal, `{ value }` for a case that loads.
 *
 * @module api_tests/api_test_leaf_import_packages/lib/probe
 */

import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { CASES, FIXTURE, refusalOf, runCase } from "./cases.mjs";

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const entry of CASES) {
			let api = null;
			const key = `${mode}/${runtime}/${entry.pkg}/${entry.folder}`;
			try {
				api = await slothlet({ base: path.join(FIXTURE, "api"), mode, runtime, silent: true });
				out[key] = { value: await runCase(api, entry) };
			} catch (error) {
				out[key] = { code: refusalOf(error)?.code ?? error?.code ?? String(error?.message ?? error) };
			} finally {
				await api?.shutdown?.();
			}
		}
process.stdout.write(JSON.stringify(out));
