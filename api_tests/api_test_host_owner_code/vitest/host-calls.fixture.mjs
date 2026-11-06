/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/vitest/host-calls.fixture.mjs
 *	@Date: 2026-11-06T05:58:47-08:00 (1793973527)
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
 * @fileoverview Run by `permissions-host-owner-inlined` in a vitest of its own (#714): boots the host package through
 * vitest's module runner, with no slothlet plugin, and prints what every call gave as one JSON line.
 * @module api_test_host_owner_code.vitest.host-calls
 */
import { it } from "vitest";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { boot, bootHost } from "../node_modules/owner-host/index.mjs";
import { makeContext as strangerContext } from "../node_modules/stranger-pkg/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(here, "..", "api");
const OWNER_CONTEXT = path.join(here, "..", "node_modules", "owner-host", "context.mjs");
const RULES = [
	{ caller: "ext.**", target: "host.**", effect: "allow" },
	{ caller: "ext.**", target: "ext.**", effect: "allow" },
	{ caller: "host.records.**", target: "store.partition", effect: "allow" }
];
const forgedContext = vm.runInThisContext(
	"(api) => ({ pin: (fn) => typeof api.slothlet.lockCaller(fn), meta: () => api.slothlet.metadata.caller()?.apiPath ?? null, " +
		"emit: () => (api.slothlet.event.emit('host:ping', { n: 1 }), 'emitted'), hostLeaf: () => api.host.echo('x') })",
	{ filename: OWNER_CONTEXT }
);

/**
 * Run a call and report what it gave or the code it failed with.
 * @param {() => Promise<unknown>} call - The call.
 * @returns {Promise<object>} The outcome.
 */
const outcome = async (call) => {
	try {
		return { ok: true, value: await call() };
	} catch (error) {
		return { ok: false, code: error?.code, caller: error?.context?.caller ?? null };
	}
};

it("reports every call", async () => {
	const out = {};
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) {
			const config = {
				base: BASE,
				mode,
				runtime,
				silent: true,
				hook: { enabled: true },
				permissions: { defaultPolicy: "deny", rules: RULES }
			};
			const { api, ctx } = await boot(slothlet, config);
			out[`${mode}/${runtime}/owner`] = await api.ext.a.activate(ctx);
			out[`${mode}/${runtime}/stranger`] = await api.ext.a.activate(strangerContext(api));
			out[`${mode}/${runtime}/forged`] = await api.ext.a.activate(forgedContext(api));
			await api.slothlet.shutdown();
			const host = await bootHost(slothlet, config);
			out[`${mode}/${runtime}/records`] = await outcome(() => host.ext.b.work());
			out[`${mode}/${runtime}/hook`] = await outcome(() => host.ext.b.callHooked());
			await host.slothlet.api.add(["ext", "c"], path.join(here, "..", "ext-pkg", "api"), { moduleID: "ext-c" });
			out[`${mode}/${runtime}/helper`] = await outcome(() => host.ext.c.useHelper());
			await host.slothlet.shutdown();
		}
	console.log(`HOST-CALLS ${JSON.stringify(out)}`);
});
