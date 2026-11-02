/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-cross-instance-callers.test.vitest.mjs
 *	@Date: 2026-10-24T01:39:57-07:00 (1792831197)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T20:52:49-07:00 (1793505169)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module of another instance is judged by this instance's rules, never as this instance's host (#625).
 *
 * Two instances share the process, and the context managers that track who is calling. Code a module of instance A
 * runs — its own, or a function the host handed it — that calls into instance B is that module, to B as to A: B
 * holds it to B's rules by its api path, as it always did, and does not count it as a removed module of B's own, of
 * which B holds no record. With nothing denying it, its calls go through, and a hook it registers in B fires.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothletInstance from "@cldmv/slothlet";

/**
 * Create an instance with `permissions.provenance` pinned off (#597, #682). These cases run this file's own code
 * inside module calls; under vitest vite transforms it, so it cannot be verified as the host's own source and
 * provenance would refuse it. Host code inside module calls with provenance on is covered under Node's own loader by
 * provenance-host-code.
 * @param {object} config - The instance's configuration.
 * @returns {Promise<object>} The api.
 */
const slothlet = (config) =>
	slothletInstance(config?.permissions ? { ...config, permissions: { provenance: false, ...config.permissions } } : config);
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const BRIDGE_KEY = "slothlet.test.i625.bridge";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("another instance's module code (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let a;
	let b;

	afterEach(async () => {
		delete globalThis[Symbol.for(BRIDGE_KEY)];
		for (const api of [a, b]) if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		a = null;
		b = null;
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("calls into the other instance, and hooks there, where its rules allow (permissions %s)", async (_label, options) => {
		a = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		b = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, hook: { enabled: true }, ...options });
		await a.slothlet.api.add("bridge", path.join(FIXTURE, "guest"), { moduleID: "bridge" });
		await b.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });

		globalThis[Symbol.for(BRIDGE_KEY)] = () => b.victim.v.secret();
		expect(await a.bridge.x.callGlobal(BRIDGE_KEY)).toBe("SECRET");

		globalThis[Symbol.for(BRIDGE_KEY)] = () => {
			b.slothlet.hook.on("victim.v.secret:after", ({ result }) => `HOOKED:${result}`);
			return "registered";
		};
		expect(await a.bridge.x.callGlobal(BRIDGE_KEY)).toBe("registered");
		expect(await b.victim.v.secret()).toBe("HOOKED:SECRET");
	});

	it("holds another instance's module code to this instance's rules", async () => {
		a = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: {} });
		b = await slothlet({
			base: path.join(FIXTURE, "base"),
			mode,
			runtime,
			silent: true,
			permissions: { rules: [{ caller: "**", target: "victim.**", effect: "deny" }] }
		});
		await a.slothlet.api.add("bridge", path.join(FIXTURE, "guest"), { moduleID: "bridge" });
		await b.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		globalThis[Symbol.for(BRIDGE_KEY)] = () => b.victim.v.secret();
		expect(await withSuppressedSlothletErrorOutput(() => a.bridge.x.callGlobal(BRIDGE_KEY))).toBe("PERMISSION_DENIED");
	});
});
