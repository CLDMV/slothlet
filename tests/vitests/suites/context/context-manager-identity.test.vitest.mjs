/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-manager-identity.test.vitest.mjs
 *	@Date: 2026-11-25T09:25:11-08:00 (1795627511)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T09:45:49-08:00 (1795628749)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The runtime is told apart by what a context manager says it is, not by its class name: a minified bundle
 * without `keepNames` renames the classes, and a check on the name then matches neither runtime (#991).
 *
 * @description
 * Each runtime is brought up, its manager class is renamed the way a minifier does (`name` redefined to `"a"`), and
 * `scope()` / `run()` are used. A class name check sends both through the "unsupported manager" error.
 * @module tests/vitests/suites/context/context-manager-identity
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

describe.each([
	{ runtime: "live", kind: "live" },
	{ runtime: "async", kind: "async" }
])("Context > manager identity survives a renamed class (#991) > $runtime", ({ runtime, kind }) => {
	let api;
	let ctor;
	let originalName;

	afterEach(async () => {
		if (ctor) Object.defineProperty(ctor, "name", { value: originalName, configurable: true });
		ctor = null;
		if (api) await api.shutdown();
		api = null;
	});

	it("scope() and run() still work when the manager's class name is minified", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "eager", context: { tag: "base" } });
		ctor = await managerClass(kind);
		originalName = ctor.name;
		Object.defineProperty(ctor, "name", { value: "a", configurable: true });
		expect(ctor.name).toBe("a");

		let inScope;
		await api.slothlet.context.scope({
			context: { tag: "scoped" },
			fn: async () => {
				inScope = (await api.slothlet.context.get()).tag;
			}
		});
		let inRun;
		await api.slothlet.context.run({ tag: "run" }, async () => {
			inRun = (await api.slothlet.context.get()).tag;
		});
		expect(inScope).toBe("scoped");
		expect(inRun).toBe("run");
	});
});

/**
 * The manager class for a runtime.
 * @param {"live"|"async"} kind - The runtime.
 * @returns {Promise<Function>} Its class.
 */
async function managerClass(kind) {
	if (kind === "live") return (await import("../../../../src/lib/handlers/context-live.mjs")).LiveContextManager;
	return (await import("../../../../src/lib/handlers/context-async.mjs")).AsyncContextManager;
}
