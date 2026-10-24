/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-cross-instance-callers.test.vitest.mjs
 *	@Date: 2026-10-24T01:39:57-07:00 (1792831197)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T01:41:39-07:00 (1792831299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host code of one instance that runs inside a module call of another is host code there (#625).
 *
 * Two instances share the process, and the context managers that track who is calling. A module of instance A
 * calling a function the host handed it, which calls into instance B, is instance A's module — never instance B's
 * caller. Instance B sees the host: its calls go through as host calls, and a hook registered there fires as one the
 * host registered.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const BRIDGE_KEY = "slothlet.test.i625.bridge";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("host code of another instance inside a module call (#625) — $mode / $runtime", ({ mode, runtime }) => {
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
	])("calls into the other instance as its host, and hooks there as its host (permissions %s)", async (_label, options) => {
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
});
