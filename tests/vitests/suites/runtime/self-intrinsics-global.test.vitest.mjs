/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-intrinsics-global.test.vitest.mjs
 *	@Date: 2026-10-23T23:35:11-07:00 (1792823711)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-23T23:40:14-07:00 (1792824014)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What is on the global object besides the realm's own intrinsics never counts as one (#625).
 *
 * The realm's intrinsics (`Object`, `Map.prototype.get`, …) belong to no module and are handed out as they are.
 * They are gathered from the global object without running anything there: a Proxy on the global object is passed
 * over, never asked for its members, whenever slothlet gathers them and whoever is running then.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GLOBAL_KEY = Symbol.for("slothlet.test.i625.trapping-global");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("a Proxy on the global object (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[GLOBAL_KEY];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it("is never asked for its members while modules read and write", async () => {
		const traps = [];
		const record =
			(name) =>
			(...args) => {
				traps.push(name);
				return Reflect[name](...args);
			};
		globalThis[GLOBAL_KEY] = new Proxy(
			{ n: 1 },
			{ ownKeys: record("ownKeys"), getOwnPropertyDescriptor: record("getOwnPropertyDescriptor"), getPrototypeOf: record("getPrototypeOf") }
		);
		vi.resetModules();
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: {} });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		expect(await api.victim.v.writeOwnSymbol()).toEqual({ assign: "done", read: 1, define: "done", remove: "done", gone: true });
		expect(api.victim.v.useOwnMembers().constructed).toBe(100);
		expect(traps).toEqual([]);
	});
});
