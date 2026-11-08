/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/calls.mjs
 *	@Date: 2026-11-08T16:00:00-08:00 (1794182400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:00-08:00 (1794182400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host of the shared-helper fixture (#715): two instances in each mode and runtime, each with module
 * `a` (imports the helper by path and by `file:` URL) and module `b` (imports it by package name). The same code runs
 * under Node's own loader (`probe.mjs`) and under vitest with the `slothletInstanceImports()` plugin (`vitest/`).
 * @module api_test_shared_helper_import_split.calls
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Both modules may call the target. */
const RULES = [
	{ caller: "a.**", target: "target.**", effect: "allow" },
	{ caller: "b.**", target: "target.**", effect: "allow" }
];

/**
 * Run a call and report what it gave or the code it failed with.
 * @param {() => Promise<unknown>} call - The call.
 * @returns {Promise<{ok: boolean, value?: unknown, code?: string, caller?: string|null}>} The outcome.
 */
const outcome = async (call) => {
	try {
		return { ok: true, value: await call() };
	} catch (error) {
		return { ok: false, code: error?.code, caller: error?.context?.caller ?? null };
	}
};

/**
 * Run every case in every mode and runtime.
 * @param {Function} slothlet - The `slothlet()` factory.
 * @returns {Promise<Record<string, unknown>>} What each instance gave, by `<mode>/<runtime>/<instance>`, and `urls`: every
 *   URL the helper was evaluated under, relative to the fixture.
 */
export async function runCalls(slothlet) {
	const out = {};
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) {
			const apis = [];
			for (let instance = 0; instance < 2; instance++) {
				const api = await slothlet({
					base: path.join(here, "target"),
					mode,
					runtime,
					silent: true,
					permissions: { defaultPolicy: "deny", rules: RULES }
				});
				apis.push(api);
				await api.slothlet.api.add("a", path.join(here, "a"), { moduleID: "mod-a" });
				await api.slothlet.api.add("b", path.join(here, "b"), { moduleID: "mod-b" });
			}
			for (const [index, api] of apis.entries()) {
				out[`${mode}/${runtime}/${index + 1}`] = {
					idByPath: (await outcome(() => api.a.idByPath())).value,
					idByURL: (await outcome(() => api.a.idByURL())).value,
					idByName: (await outcome(() => api.b.idByName())).value,
					viaPath: await outcome(() => api.a.viaPath()),
					viaURL: await outcome(() => api.a.viaURL()),
					viaName: await outcome(() => api.b.viaName())
				};
			}
			for (const api of apis) await api.slothlet.shutdown();
		}
	const prefix = `${path.basename(here)}/`;
	out.urls = (globalThis.__sharedHelperImportSplit?.urls ?? []).map((url) => url.slice(url.indexOf(prefix) + prefix.length));
	return out;
}
