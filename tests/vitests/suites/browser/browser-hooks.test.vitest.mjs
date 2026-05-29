/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-hooks.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-29 08:52:23 -07:00 (1780069943)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for the hook system in browser mode.
 *
 * @description
 * The existing browser parity tests verify that `api.math.add(10, 5)` returns
 * the same value in Node and browser modes — but they say nothing about whether
 * hooks are actually invoked, whether they can modify arguments or results, or
 * whether the hook chain fires in priority order. A bug in how the browser API
 * tree is wired up (wrong function references, missing wrapping, broken live
 * bindings) could leave hooks silently not firing even while return values look
 * identical.
 *
 * Covers:
 * - `before:` hooks are invoked and can modify call arguments
 * - `after:` hooks are invoked and can transform the return value
 * - Hook priority ordering is preserved in browser mode
 * - Short-circuit via `before:` hook works (returns early, skips the real fn)
 * - `hook.off` removes a registered hook
 * - Matrix restricted to hook-enabled configs
 *
 * @module tests/vitests/suites/browser/browser-hooks
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function browserCfg(matrixConfig) {
	return makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST);
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Browser Mode > hooks > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("before: hook is invoked and can modify arguments", async () => {
		api = await slothlet(browserCfg(config));

		// Double the first argument before math.add executes
		api.slothlet.hook.on(
			"before:math.add",
			({ args }) => [args[0] * 2, args[1]],
			{ id: "double-a" }
		);

		// Without hook: add(2, 3) = 5. With hook: add(4, 3) = 7.
		expect(await api.math.add(2, 3)).toBe(7);
	});

	it("after: hook is invoked and can transform the result", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.hook.on(
			"after:math.multiply",
			({ result }) => result + 100,
			{ id: "add-100" }
		);

		// Without hook: multiply(3, 4) = 12. With hook: 12 + 100 = 112.
		expect(await api.math.multiply(3, 4)).toBe(112);
	});

	it("higher-priority before: hooks run before lower-priority ones", async () => {
		api = await slothlet(browserCfg(config));

		const order = [];

		api.slothlet.hook.on("before:math.add", () => { order.push("low"); }, { id: "low", priority: 100 });
		api.slothlet.hook.on("before:math.add", () => { order.push("high"); }, { id: "high", priority: 300 });

		await api.math.add(1, 1);

		expect(order).toEqual(["high", "low"]);
	});

	it("before: hook can short-circuit and skip the real function", async () => {
		api = await slothlet(browserCfg(config));

		let realCalled = false;
		// Wrap math.add with a hook that verifies the real fn is bypassed.
		// Short-circuit by returning a non-array value from a before: hook.
		api.slothlet.hook.on(
			"before:math.add",
			() => 999,
			{ id: "short-circuit" }
		);

		const result = await api.math.add(1, 1);
		expect(result).toBe(999);
		void realCalled; // not observable without mocking — assert via return value only
	});

	it("hook.off removes a registered hook", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.hook.on("before:math.add", ({ args }) => [args[0] * 10, args[1]], { id: "multiply-10" });

		// Hook active: add(2, 3) → add(20, 3) = 23
		expect(await api.math.add(2, 3)).toBe(23);

		api.slothlet.hook.off("multiply-10");

		// Hook removed: add(2, 3) = 5
		expect(await api.math.add(2, 3)).toBe(5);
	});

	it("wildcard before:** hook fires for any path", async () => {
		api = await slothlet(browserCfg(config));

		const fired = [];
		api.slothlet.hook.on("before:**", ({ path }) => { fired.push(path); }, { id: "wildcard" });

		await api.math.add(1, 1);
		await api.math.multiply(2, 2);

		expect(fired).toContain("math.add");
		expect(fired).toContain("math.multiply");
	});
});
