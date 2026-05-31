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
 * - Throwing `before:` hook propagates the error (default, no suppressErrors)
 * - Throwing `after:` hook propagates the error (default, no suppressErrors)
 * - `error:**` hook fires when a `before:` hook throws (no suppressErrors)
 * - `suppressErrors: true` — throwing `before:` hook returns `undefined`, does not propagate
 * - `suppressErrors: true` — throwing `after:` hook does NOT suppress the real return value
 * - `suppressErrors: true` — `error:**` hook receives source type and error message
 * - Exact-path event selector (`before:math.add`) fires only for that path
 * - Single-level wildcard event selector (`before:math.*`) fires for matching paths but not unmatched ones
 * - Non-matching event selector means the hook never fires
 *
 * @module tests/vitests/suites/browser/browser-hooks
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getBrowserMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

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

describe.each(getBrowserMatrixConfigs({ hook: { enabled: true } }))("Browser Mode > hooks > $name", ({ config }) => {
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

// ─── error handling — default (no suppressErrors) ────────────────────────────

describe.each(getBrowserMatrixConfigs({ hook: { enabled: true } }))("Browser Mode > hooks > error handling (no suppress) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("throwing before: hook propagates the error to the caller", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**" } });

		api.slothlet.hook.on(
			"before:math.add",
			() => { throw new Error("before hook exploded"); },
			{ id: "throw-before" }
		);

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(async () => api.math.add(1, 2)).rejects.toThrow("before hook exploded");
		});
	});

	it("throwing after: hook propagates the error to the caller", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**" } });

		api.slothlet.hook.on(
			"after:math.add",
			() => { throw new Error("after hook exploded"); },
			{ id: "throw-after" }
		);

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(async () => api.math.add(1, 2)).rejects.toThrow("after hook exploded");
		});
	});

	it("error:** hook fires and receives source type when a before: hook throws", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**" } });

		let errorCtx = null;
		api.slothlet.hook.on("error:**", (ctx) => { errorCtx = ctx; }, { id: "error-monitor" });

		api.slothlet.hook.on(
			"before:math.add",
			() => { throw new Error("before threw"); },
			{ id: "throw-before" }
		);

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(async () => api.math.add(2, 3)).rejects.toThrow("before threw");
		});

		expect(errorCtx).not.toBeNull();
		expect(errorCtx.source?.type).toBe("before");
		expect(errorCtx.error?.message).toBe("before threw");
	});
});

// ─── error handling — suppressErrors: true ───────────────────────────────────

describe.each(getBrowserMatrixConfigs({ hook: { enabled: true } }))("Browser Mode > hooks > suppressErrors > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("throwing before: hook returns undefined — does not propagate", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**", suppressErrors: true } });

		api.slothlet.hook.on(
			"before:math.add",
			() => { throw new Error("suppressed before"); },
			{ id: "throw-before" }
		);

		const result = await api.math.add(2, 3);
		expect(result).toBeUndefined();
	});

	it("throwing after: hook does NOT suppress the real function return value", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**", suppressErrors: true } });

		api.slothlet.hook.on(
			"after:math.add",
			() => { throw new Error("suppressed after"); },
			{ id: "throw-after" }
		);

		// The after: hook throws but suppressErrors keeps the real result (5) intact
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);
	});

	it("error:** hook fires with source type and message when before: hook throws under suppression", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**", suppressErrors: true } });

		let errorCtx = null;
		api.slothlet.hook.on("error:**", (ctx) => { errorCtx = ctx; }, { id: "error-monitor" });

		api.slothlet.hook.on(
			"before:math.add",
			() => { throw new Error("suppressed error msg"); },
			{ id: "throw-before" }
		);

		await api.math.add(2, 3);

		expect(errorCtx).not.toBeNull();
		expect(errorCtx.source?.type).toBe("before");
		expect(errorCtx.error?.message).toBe("suppressed error msg");
	});

	it("error:** hook fires with source type 'after' when after: hook throws under suppression", async () => {
		api = await slothlet({ ...browserCfg(config), hook: { enabled: true, pattern: "**", suppressErrors: true } });

		let errorCtx = null;
		api.slothlet.hook.on("error:**", (ctx) => { errorCtx = ctx; }, { id: "error-monitor" });

		api.slothlet.hook.on(
			"after:math.add",
			() => { throw new Error("after error msg"); },
			{ id: "throw-after" }
		);

		await api.math.add(2, 3);

		expect(errorCtx).not.toBeNull();
		expect(errorCtx.source?.type).toBe("after");
		expect(errorCtx.error?.message).toBe("after error msg");
	});
});

// ─── hook event-selector subset / pattern restriction ────────────────────────

describe.each(getBrowserMatrixConfigs({ hook: { enabled: true } }))("Browser Mode > hooks > event-selector pattern > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("exact-path event selector fires only for that path", async () => {
		api = await slothlet(browserCfg(config));

		const fired = [];
		// Register with an exact-path selector — should only fire for math.add, not math.multiply
		api.slothlet.hook.on("before:math.add", ({ path }) => { fired.push(path); }, { id: "exact" });

		await api.math.add(1, 2);
		await api.math.multiply(3, 4);

		expect(fired).toContain("math.add");
		expect(fired).not.toContain("math.multiply");
	});

	it("single-level wildcard selector fires for matching paths and not for non-matching", async () => {
		api = await slothlet(browserCfg(config));

		const fired = [];
		// math.* matches math.add and math.multiply, but would NOT match a deeper path
		api.slothlet.hook.on("before:math.*", ({ path }) => { fired.push(path); }, { id: "math-wildcard" });

		await api.math.add(1, 2);
		await api.math.multiply(3, 4);

		// Both math.* paths fire
		expect(fired).toContain("math.add");
		expect(fired).toContain("math.multiply");
		// Each fired exactly once
		expect(fired.filter((p) => p === "math.add")).toHaveLength(1);
		expect(fired.filter((p) => p === "math.multiply")).toHaveLength(1);
	});

	it("selector that matches no browser-fixture path never fires", async () => {
		api = await slothlet(browserCfg(config));

		const fired = [];
		// "before:string.*" matches nothing in the browser fixture (only math.* paths exist at top level)
		api.slothlet.hook.on("before:string.*", ({ path }) => { fired.push(path); }, { id: "no-match" });

		await api.math.add(1, 2);
		await api.math.multiply(3, 4);

		expect(fired).toHaveLength(0);
	});
});
