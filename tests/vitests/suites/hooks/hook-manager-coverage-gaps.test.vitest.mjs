/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-manager-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for previously-unreached HookManager branches.
 *
 * @description
 * Covers:
 *   line 321   `list({ id, enabled })` — third branch of the compound `&&/||` condition:
 *              `hook && (filter.enabled === undefined || hook.enabled === filter.enabled)`
 *              The third branch fires when `filter.enabled` is specified but does NOT match
 *              `hook.enabled` (e.g. hook is enabled=true, filter is enabled:false). In that
 *              case the hook is found by ID but excluded from results.
 *
 *   line 603   `executeErrorHooks` — `error?.constructor?.name || "Error"` fallback.
 *              Fires when the thrown error object has no `constructor` (e.g. created via
 *              `Object.create(null)`). The `?.constructor?.name` chain evaluates to
 *              `undefined`, triggering the `|| "Error"` default string.
 *
 * @module tests/vitests/suites/hooks/hook-manager-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	if (api) {
		await api.slothlet.shutdown();
		api = null;
	}
});

/**
 * Retrieve the raw internal Slothlet instance from a slothlet API proxy.
 *
 * @param {object} apiProxy - Live slothlet API proxy.
 * @param {string} [prop="math"] - A property that has a unified wrapper.
 * @returns {object} Internal Slothlet instance.
 *
 * @example
 * const sl = getSlInstance(api);
 * sl.handlers.hookManager.executeErrorHooks(...);
 */
function getSlInstance(apiProxy, prop = "math") {
	const wrapper = resolveWrapper(apiProxy[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

// ─── list({ id, enabled }) — mismatched enabled (line 321 third branch) ──────

describe("HookManager.list — filter.enabled mismatch with hook.enabled (line 321 branch 3)", () => {
	it("returns empty list when hook is enabled but filter requests disabled (line 321 third branch)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: true,
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		// Register a hook — it is enabled by default
		const hookId = api.slothlet.hook.on("before:**", () => {});

		// Confirm the hook is enabled
		const allHooks = api.slothlet.hook.list({ id: hookId });
		expect(allHooks.registeredHooks).toHaveLength(1);
		expect(allHooks.registeredHooks[0].enabled).toBe(true);

		// Now filter by this ID but request only DISABLED hooks.
		// hook.enabled=true, filter.enabled=false → mismatch → line 321:
		//   hook && (filter.enabled === undefined  [false]
		//            || hook.enabled === filter.enabled  [false])
		// → if(hook && false) → false → skip push → empty result
		const filtered = api.slothlet.hook.list({ id: hookId, enabled: false });

		expect(filtered.registeredHooks).toHaveLength(0);
	});

	it("returns empty list when hook is disabled but filter requests enabled (line 321 third branch)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: true,
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		const hookId = api.slothlet.hook.on("before:**", () => {});

		// Disable this hook via disable({ id })
		api.slothlet.hook.disable({ id: hookId });

		const allHooks = api.slothlet.hook.list({ id: hookId });
		expect(allHooks.registeredHooks[0].enabled).toBe(false);

		// Filter for enabled: true, but hook is disabled → mismatch → line 321 third branch
		const filtered = api.slothlet.hook.list({ id: hookId, enabled: true });

		expect(filtered.registeredHooks).toHaveLength(0);
	});
});

// ─── executeErrorHooks — || "Error" fallback (line 603) ──────────────────────

describe("HookManager.executeErrorHooks — error?.constructor?.name || 'Error' fallback (line 603)", () => {
	it("uses 'Error' fallback when thrown object has no constructor (Object.create(null), line 603)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: true,
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		const sl = getSlInstance(api);

		// Capture what errorType the error hook receives
		let capturedErrorType;
		api.slothlet.hook.on("error:**", ({ errorType }) => {
			capturedErrorType = errorType;
		});

		// Object.create(null) has no prototype → .constructor is undefined
		// → error?.constructor?.name evaluates to undefined → || "Error" fires (line 603)
		const bareObj = Object.create(null);

		sl.handlers.hookManager.executeErrorHooks(
			"math.add",
			bareObj,
			{ type: "before", hookTag: "test-coverage", hookId: null, timestamp: new Date(), stack: "" },
			[],
			api,
			{}
		);

		expect(capturedErrorType).toBe("Error");
	});

	it("uses actual constructor name for normal Error objects (confirming the truthy path works)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: true,
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		const sl = getSlInstance(api);

		let capturedErrorType;
		api.slothlet.hook.on("error:**", ({ errorType }) => {
			capturedErrorType = errorType;
		});

		// Normal TypeError — constructor.name is "TypeError"
		sl.handlers.hookManager.executeErrorHooks(
			"math.add",
			new TypeError("test"),
			{ type: "before", hookTag: "test-coverage", hookId: null, timestamp: new Date(), stack: "" },
			[],
			api,
			{}
		);

		expect(capturedErrorType).toBe("TypeError");
	});
});
