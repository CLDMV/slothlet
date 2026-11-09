/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_imports/calls.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:52-08:00 (1794185812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host of the own-package fixture (#715): two instances in each mode and runtime over `pkg/api`, whose
 * leaves `a`, `b` and `c` import one helper of their package by a relative path, by `#h` and by the package's own name.
 * The same code runs under Node's own loader (`probe.mjs`) and under vitest with the `slothletInstanceImports()` plugin
 * (`vitest/`).
 * @module api_test_own_package_imports.calls
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run every mode and runtime.
 * @param {Function} slothlet - The `slothlet()` factory.
 * @returns {Promise<Record<string, unknown>>} Which evaluation of the helper each leaf reached, by
 *   `<mode>/<runtime>/<instance>`, and `urls`: every URL the helper was evaluated under, relative to the fixture.
 */
export async function runCalls(slothlet) {
	const out = {};
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) {
			const apis = [];
			for (let instance = 0; instance < 2; instance++)
				apis.push(await slothlet({ base: path.join(here, "pkg", "api"), mode, runtime, silent: true }));
			for (const [index, api] of apis.entries()) {
				out[`${mode}/${runtime}/${index + 1}`] = {
					byPath: await api.a.which(),
					byImports: await api.b.which(),
					bySelf: await api.c.which()
				};
			}
			for (const api of apis) await api.slothlet.shutdown();
		}
	const prefix = `${path.basename(here)}/`;
	out.urls = (globalThis.__ownPackageImports?.urls ?? []).map((url) => url.slice(url.indexOf(prefix) + prefix.length).split("?")[0]);
	out.tagged = (globalThis.__ownPackageImports?.urls ?? []).map((url) => url.includes("slothlet_instance="));
	return out;
}
