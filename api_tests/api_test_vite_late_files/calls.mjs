/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/calls.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T20:28:57-08:00 (1794025737)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host of the late-files fixture (#714): it creates the instance, and only then imports a package's
 * files and hands their context to a module, has one module hand another a function, and mounts a module that imports a
 * JSON file. The same code runs under
 * Node's own loader (`probe.mjs`) and under vitest with the `slothletInstanceImports()` plugin (`vitest/`).
 * @module api_test_vite_late_files.calls
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The rules: modules call the host's leaves, and the caller and callee modules call the callee's leaves. */
const RULES = [
	{ caller: "runner.**", target: "host.**", effect: "allow" },
	{ caller: "caller", target: "callee.**", effect: "allow" },
	{ caller: "caller.**", target: "callee.**", effect: "allow" },
	{ caller: "callee", target: "callee.**", effect: "allow" },
	{ caller: "callee.**", target: "callee.**", effect: "allow" }
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
 * Run every call in every mode and runtime.
 * @param {Function} slothlet - The `slothlet()` factory.
 * @returns {Promise<Record<string, unknown>>} What each call gave, by `<mode>/<runtime>/<case>`.
 */
export async function runCalls(slothlet) {
	const out = {};
	let round = 0;
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) {
			const api = await slothlet({
				base: path.join(here, "api"),
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "deny", rules: RULES }
			});
			await api.slothlet.api.add("host", { echo: (value) => `echo:${value}` }, { moduleID: "host-mod" });
			// A query of its own each round, so every round imports the package's files anew after its instance exists.
			const query = `?round=${round++}`;
			const late = await import(pathToFileURL(path.join(here, "late-pkg", "context.mjs")).href + query);
			const importing = await import(pathToFileURL(path.join(here, "late-pkg", "imports.mjs")).href + query);
			out[`${mode}/${runtime}/late`] = await api.runner.activate(late.makeContext(api));
			out[`${mode}/${runtime}/importing`] = await api.runner.activate(importing.makeContext(api));
			await api.caller.setup();
			out[`${mode}/${runtime}/handed`] = await outcome(() => api.callee.fire());
			out[`${mode}/${runtime}/json`] = await outcome(async () => {
				await api.slothlet.api.add("info", path.join(here, "json-api"), { moduleID: "info" });
				return api.info.name();
			});
			await api.slothlet.shutdown();
		}
	return out;
}
