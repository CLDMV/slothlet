/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-self.test.vitest.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:03 -07:00 (1780546683)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for the `self` live-binding in browser mode.
 *
 * @description
 * `self` is the live runtime binding that lets a leaf call sibling leaves as wrapped functions —
 * hooks, permissions, and context all apply to `self.*` calls exactly as they do to external
 * calls. In Node mode this is verified incidentally; in browser mode it is exercised only by
 * the Playwright Chromium smoke, which does not contribute to `npm run coverage`. A regression
 * in the browser-mode `self` wiring (wrong reference, raw-function leak, broken proxy) would
 * slip through the Node coverage run entirely.
 *
 * Covers (all under browser mode — manifest presence forces the live runtime):
 * - `api.advanced.calc.addViaSelf(2, 3)` === 5 (cross-leaf `self` call: advanced → math)
 * - `api.probe.viaSelf("math.add", 2, 3)` === 5 (self across top-level namespaces)
 * - `api.probe.viaSelf("math.multiply", 3, 4)` === 12 (self across top-level namespaces)
 * - `api.probe.viaSelf("advanced.calc.addViaSelf", 2, 3)` === 5 (nested/deep self path)
 * - `self` routes through the wrapper: a `math.add:before` hook that doubles arg0 is observed by a self-routed call (proves `self` returns wrapped functions, not raw exports)
 * - `self` works in lazy mode (self resolves after lazy materialization)
 *
 * @module tests/vitests/suites/browser/browser-self
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getBrowserMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

/**
 * Build a browser-mode config, optionally extending it (e.g. with extra hook or context settings).
 * @param {object} matrixConfig
 * @param {object} [extra]
 * @returns {object}
 */
function browserCfg(matrixConfig, extra = {}) {
	return { ...makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST), ...extra };
}

// ─── cross-namespace self calls (all matrix configs) ──────────────────────────

describe.each(getBrowserMatrixConfigs())("Browser Mode > self > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("addViaSelf delegates to self.math.add (cross-leaf, advanced → math)", async () => {
		api = await slothlet(browserCfg(config));

		// advanced/calc.mjs calls self.math.add(a, b) internally — proves self is wired
		expect(await api.advanced.calc.addViaSelf(2, 3)).toBe(5);
	});

	it("probe.viaSelf resolves self.math.add across top-level namespaces", async () => {
		api = await slothlet(browserCfg(config));

		// probe.mjs walks self via dotted path — exercises the live-binding proxy chain
		expect(await api.probe.viaSelf("math.add", 2, 3)).toBe(5);
	});

	it("probe.viaSelf resolves self.math.multiply across top-level namespaces", async () => {
		api = await slothlet(browserCfg(config));

		expect(await api.probe.viaSelf("math.multiply", 3, 4)).toBe(12);
	});

	it("probe.viaSelf resolves deep nested path self.advanced.calc.addViaSelf", async () => {
		api = await slothlet(browserCfg(config));

		// Depth test: self navigates three levels (advanced → calc → addViaSelf),
		// which in turn navigates self.math.add — exercises recursive self resolution
		expect(await api.probe.viaSelf("advanced.calc.addViaSelf", 2, 3)).toBe(5);
	});

	it("self works in lazy mode — resolves after lazy materialization", async () => {
		// Covered by the matrix (lazy × async and lazy × live configs are included).
		// Explicitly asserting here because self resolution could differ if the lazy
		// wrapper dereferences self at wrap-time vs call-time.
		api = await slothlet(browserCfg(config));

		// Trigger both lazy and eager code paths through the same assertion
		expect(await api.advanced.calc.addViaSelf(10, 5)).toBe(15);
		expect(await api.probe.viaSelf("math.add", 10, 5)).toBe(15);
	});
});

// ─── self routes through wrapper (hook-enabled configs only) ──────────────────

describe.each(getBrowserMatrixConfigs({ hook: { enabled: true } }))(
	"Browser Mode > self > hooks > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("self-routed call goes through the hook wrapper (math.add:before doubles arg0)", async () => {
			api = await slothlet(browserCfg(config));

			// Register a before: hook that doubles the first argument
			api.slothlet.hook.on(
				"math.add:before",
				({ args }) => [args[0] * 2, args[1]],
				{ id: "double-a-self" }
			);

			// Direct call goes through the hook: add(2, 3) → add(4, 3) = 7
			expect(await api.math.add(2, 3)).toBe(7);

			// Self-routed call via addViaSelf must ALSO go through the hook —
			// this is the key invariant: self returns WRAPPED functions, not raw exports
			expect(await api.advanced.calc.addViaSelf(2, 3)).toBe(7);
		});

		it("self-routed call via probe.viaSelf also goes through the hook wrapper", async () => {
			api = await slothlet(browserCfg(config));

			api.slothlet.hook.on(
				"math.add:before",
				({ args }) => [args[0] * 3, args[1]],
				{ id: "triple-a-self" }
			);

			// Direct call: add(2, 3) → add(6, 3) = 9
			expect(await api.math.add(2, 3)).toBe(9);

			// self call routed via probe.viaSelf must hit the same hook
			expect(await api.probe.viaSelf("math.add", 2, 3)).toBe(9);
		});

		it("after: hook on self-routed path transforms the result", async () => {
			api = await slothlet(browserCfg(config));

			api.slothlet.hook.on(
				"math.multiply:after",
				({ result }) => result + 1000,
				{ id: "add-1000-self" }
			);

			// Direct call: multiply(3, 4) = 12 + 1000 = 1012
			expect(await api.math.multiply(3, 4)).toBe(1012);

			// Self-routed via probe.viaSelf — result hook must apply
			expect(await api.probe.viaSelf("math.multiply", 3, 4)).toBe(1012);
		});
	}
);
