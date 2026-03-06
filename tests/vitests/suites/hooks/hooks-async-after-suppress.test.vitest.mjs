/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-async-after-suppress.test.vitest.mjs
 *	@Date: 2026-03-03 09:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:32:01 -08:00 (1772699521)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage test for unified-wrapper.mjs line 2644 — suppressErrors inside the
 * async after-hook catch handler.
 *
 * @description
 * Line 2644 in unified-wrapper.mjs is inside the `.then(resolvedResult => { ... })` success
 * handler of the async result chain.  When an after-hook throws AFTER the function returns a
 * resolved Promise, the catch block in that success handler fires.  If `suppressErrors` is
 * `true`, line 2644 `return undefined` is reached instead of re-throwing.
 *
 * The existing `hooks-suppress-errors.test.vitest.mjs` suite uses `math.add` which is a
 * SYNCHRONOUS function — its result never enters the `.then()` path, so line 2644 goes
 * untested there.  This file triggers it with a genuinely async function (`asyncTest.asyncAdd`)
 * whose resolved value then encounters a throwing after-hook.
 *
 * Fixture: `api_tests/api_test/async-test.mjs`
 * - `asyncAdd(a, b)` → async, returns Promise<number>
 *
 * @module tests/vitests/suites/hooks/hooks-async-after-suppress.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		try {
			await _api.shutdown();
		} catch {
			// ignore
		}
	}
	_api = null;
});

// ---------------------------------------------------------------------------
// Line 2644: suppressErrors inside the async after-hook catch handler
// Conditions:
//   1. function returns a Promise that resolves successfully
//   2. an after-hook throws during the .then() success handler
//   3. config.hook.suppressErrors === true
// ---------------------------------------------------------------------------

describe("unified-wrapper line 2644 — suppressed async after-hook error", () => {
	it("returns undefined when after-hook throws on an async function with suppressErrors=true (line 2644)", async () => {
		// Strategy: line 2644 sits in the .then() success-handler catch block.
		// It is only reached when:
		//   - hookManager.suppressErrors === false  (set at construction → re-throws from executeAfterHooks)
		//   - wrapper.slothlet.config.hook.suppressErrors === true  (live config, read at catch time)
		//
		// We achieve this by creating the API with suppressErrors:false so the HookManager caches
		// suppressErrors=false, then mutating the live config to true before the call.
		// When the after-hook throws, executeAfterHooks re-throws (hookManager.suppressErrors=false),
		// the catch fires, the live-config check sees true → line 2644: return undefined.
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: true, pattern: "**", suppressErrors: false },
			collision: { initial: "replace", api: "replace" },
			silent: true,
			dir: TEST_DIRS.API_TEST
		});

		expect(_api.asyncTest?.asyncAdd).toBeDefined();

		// Get the live config object through the asyncTest wrapper so we can mutate it
		const wrapper = resolveWrapper(_api.asyncTest);
		expect(wrapper).not.toBeNull();
		const liveHookConfig = wrapper.slothlet.config.hook;

		// Mutate live config: hookManager still has suppressErrors=false but config now says true
		const savedSuppressErrors = liveHookConfig.suppressErrors;
		liveHookConfig.suppressErrors = true;

		let errorHookCalled = false;
		_api.slothlet.hook.on(
			"error:**",
			() => {
				errorHookCalled = true;
			},
			{ id: "async-error-monitor" }
		);

		// Register an after-hook that throws.
		// hookManager.suppressErrors=false → executeAfterHooks re-throws.
		// catch: liveConfig.suppressErrors=true → line 2644: return undefined.
		_api.slothlet.hook.on(
			"after:asyncTest.asyncAdd",
			() => {
				throw new Error("async after-hook failure");
			},
			{ id: "failing-async-after" }
		);

		try {
			const result = await _api.asyncTest.asyncAdd(2, 3);
			// suppressErrors=true in live config → undefined returned (line 2644)
			expect(result).toBeUndefined();
			expect(errorHookCalled).toBe(true);
		} finally {
			// Restore original config to avoid affecting other tests
			liveHookConfig.suppressErrors = savedSuppressErrors;
		}
	});

	it("re-throws when after-hook throws on an async function with suppressErrors=false (line 2647)", async () => {
		// Both hookManager and live config have suppressErrors=false → re-throws at line 2647
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: true, pattern: "**", suppressErrors: false },
			collision: { initial: "replace", api: "replace" },
			silent: true,
			dir: TEST_DIRS.API_TEST
		});

		_api.slothlet.hook.on(
			"after:asyncTest.asyncAdd",
			() => {
				throw new Error("async after-hook failure");
			},
			{ id: "failing-async-after-2" }
		);

		// suppressErrors=false → error is re-thrown (line 2647: throw error)
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(_api.asyncTest.asyncAdd(1, 2)).rejects.toThrow("async after-hook failure");
		});
	});
});
