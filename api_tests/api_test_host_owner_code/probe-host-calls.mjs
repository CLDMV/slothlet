/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/probe-host-calls.mjs
 *	@Date: 2026-11-06T05:58:16-08:00 (1793973496)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T06:24:36-08:00 (1793975076)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Boots the #714 host package under Node's own loader, loaded before slothlet as rummage is, and prints
 * what a module gets from the host's own record leaf (handed a callback) and from a leaf the host's `around` hook
 * wraps, as JSON, for every mode and runtime.
 * @module api_test_host_owner_code.probe-host-calls
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootHost } from "owner-host";

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: slothlet } = await import("@cldmv/slothlet");

/** The rules: modules call the host's leaves and their own; only the host's record leaves open partitions. */
const RULES = [
	{ caller: "ext.**", target: "host.**", effect: "allow" },
	{ caller: "ext.**", target: "ext.**", effect: "allow" },
	{ caller: "host.records.**", target: "store.partition", effect: "allow" }
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

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) {
		const api = await bootHost(slothlet, {
			base: path.join(here, "api"),
			mode,
			runtime,
			silent: true,
			hook: { enabled: true },
			permissions: { defaultPolicy: "deny", rules: RULES }
		});
		out[`${mode}/${runtime}/records`] = await outcome(() => api.ext.b.work());
		out[`${mode}/${runtime}/hook`] = await outcome(() => api.ext.b.callHooked());
		await api.slothlet.api.add(["ext", "c"], path.join(here, "ext-pkg", "api"), { moduleID: "ext-c" });
		out[`${mode}/${runtime}/helper`] = await outcome(() => api.ext.c.useHelper());
		await api.slothlet.shutdown();
	}
console.log(JSON.stringify(out));
