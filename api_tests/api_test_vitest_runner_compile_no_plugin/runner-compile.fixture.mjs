/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vitest_runner_compile_no_plugin/runner-compile.fixture.mjs
 *	@Date: 2026-11-17T04:54:31-08:00 (1794920071)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:21-08:00 (1794929181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `permissions-vitest-runner-compile-no-plugin` in a vitest of its own: loads the runner-compile
 * probe with the permission system on, under vitest with no slothlet plugin, and prints what each config gave as one
 * JSON line.
 * @module api_test_vitest_runner_compile_no_plugin.runner-compile
 */
import { it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api_test_vitest_runner_compile");

it("reports every config", async () => {
	const out = {};
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) {
			let api = null;
			try {
				api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: {} });
				out[`${mode}/${runtime}`] = await api.probe.result();
			} catch (error) {
				out[`${mode}/${runtime}`] = { error: error?.code ?? String(error?.message ?? error) };
			} finally {
				if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			}
		}
	process.stdout.write(`RUNNER-COMPILE ${JSON.stringify(out)}\n`);
});
