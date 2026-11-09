/**
 * @fileoverview The host of the own-package require fixture (#715): two instances in each mode and runtime over each of
 * `pkg/imports` and `pkg/self`, whose `.cjs` leaf requires its package's helpers by `#imports`, by the package's own name
 * and by a relative path (each api puts a different bare spelling first), beside an ES module leaf that imports them by
 * `#imports`. The same code runs under Node's own loader
 * (`probe.mjs`) and under vitest with the `slothletInstanceImports()` plugin (`vitest/`).
 * @module api_test_own_package_requires.calls
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run every mode and runtime.
 * @param {Function} slothlet - The `slothlet()` factory.
 * @returns {Promise<Record<string, unknown>>} What each leaf reached, by `<api>/<mode>/<runtime>/<instance>`, and for each
 *   helper the files it was evaluated from (relative to the fixture) and whether each evaluation carried an instance tag.
 */
export async function runCalls(slothlet) {
	const out = {};
	for (const base of ["imports", "self"])
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"]) {
				const apis = [];
				for (let instance = 0; instance < 2; instance++)
					apis.push(await slothlet({ base: path.join(here, "pkg", base), mode, runtime, silent: true }));
				for (const [index, api] of apis.entries()) {
					out[`${base}/${mode}/${runtime}/${index + 1}`] = { req: await api.req.which(), esm: await api.esm.which() };
				}
				for (const api of apis) await api.slothlet.shutdown();
			}
	const prefix = `${path.basename(here)}/`;
	const state = globalThis.__ownPackageRequires ?? { h: [], c: [] };
	/**
	 * A helper's evaluations, as files relative to the fixture.
	 * @param {Array<{url: string}>} list - The evaluations.
	 * @returns {string[]} The files.
	 */
	const files = (list) =>
		list.map(({ url }) => url.split(path.sep).join("/")).map((url) => url.slice(url.indexOf(prefix) + prefix.length).split("?")[0]);
	out.h = { files: files(state.h), tagged: state.h.map(({ url }) => url.includes("slothlet_instance=")) };
	out.c = { files: files(state.c) };
	return out;
}
