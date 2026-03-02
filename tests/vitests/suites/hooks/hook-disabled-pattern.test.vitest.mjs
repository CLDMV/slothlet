/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-disabled-pattern.test.vitest.mjs
 *	@Date: 2026-03-01 12:34:06 -08:00 (1772397246)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:31:04 -08:00 (1772411464)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-gap test for hook-manager.mjs line 404.
 *
 * @description
 * `getHooksForPath()` in HookManager maintains an inner loop over per-pattern hook arrays.
 * When iterating over **pattern hooks** (non-exact-match patterns like `"math.*"` or `"**"`),
 * each individual hook is checked for its `enabled` flag before being compiled/matched:
 *
 * ```javascript
 * for (const hook of patternHooks) {
 *     if (!hook.enabled) continue;  // ← line 404 — previously uncovered
 *     ...
 * }
 * ```
 *
 * This `continue` branch fires only when:
 * 1. The hook was registered with a **glob pattern** (not an exact path match).
 * 2. The hook was subsequently **disabled** via `api.slothlet.hook.disable()`.
 * 3. An API function whose path matches that pattern is then **called**, triggering
 *    `getHooksForPath(type, apiPath)`.
 *
 * The existing test suite exercises disabled hooks via `importHooks` round-trips but
 * never invokes a user API function while a disabled **pattern** hook is in the hook
 * registry — meaning the inner loop body at line 404 was never reached.
 *
 * @module tests/vitests/suites/hooks/hook-disabled-pattern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared setup ─────────────────────────────────────────────────────────────

let api;

beforeEach(async () => {
	api = await slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "eager",
		hook: { enabled: true },
		collision: { initial: "replace", api: "replace" },
		silent: true
	});
});

afterEach(async () => {
	if (api) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

// ─── Line 404: disabled pattern hook skipped in inner loop ────────────────────

describe("HookManager.getHooksForPath — disabled pattern hook (line 404)", () => {
	it("disabled 'before:**' hook is skipped when an API function is called (line 404)", async () => {
		const handlerSpy = vi.fn();

		// Register a wildcard pattern hook that matches everything
		const hookId = api.slothlet.hook.on("before:**", handlerSpy);
		expect(typeof hookId).toBe("string");

		// Verify the hook fires while still enabled
		await api.math.add(1, 2);
		expect(handlerSpy).toHaveBeenCalled();
		handlerSpy.mockClear();

		// Disable the hook — sets hook.enabled = false
		api.slothlet.hook.disable({ id: hookId });

		// Call an API function — getHooksForPath iterates patternHooks,
		// finds this hook with enabled=false → `if (!hook.enabled) continue;` (line 404)
		await api.math.add(1, 2);

		// Handler must NOT have been called (the hook was disabled)
		expect(handlerSpy).not.toHaveBeenCalled();
	});

	it("disabled 'before:math.*' pattern hook is skipped for math.add calls (line 404)", async () => {
		const handlerSpy = vi.fn();

		// Register a specific pattern hook for math namespace
		const hookId = api.slothlet.hook.on("before:math.*", handlerSpy);
		expect(typeof hookId).toBe("string");

		// Confirm hook fires while enabled
		await api.math.add(1, 2);
		expect(handlerSpy).toHaveBeenCalled();
		handlerSpy.mockClear();

		// Disable just this pattern hook
		api.slothlet.hook.disable({ id: hookId });

		// Calling math.add — pattern "math.*" ≠ "math.add" → inner loop runs
		// disabled hook found → `if (!hook.enabled) continue` (line 404)
		await api.math.add(3, 4);
		expect(handlerSpy).not.toHaveBeenCalled();
	});

	it("re-enabling a disabled pattern hook restores its effect (line 404 skipped once, then not)", async () => {
		const handlerSpy = vi.fn();
		const hookId = api.slothlet.hook.on("before:**", handlerSpy);

		// Disable then re-enable
		api.slothlet.hook.disable({ id: hookId });
		await api.math.add(1, 2);
		expect(handlerSpy).not.toHaveBeenCalled(); // disabled path exercised (line 404)

		api.slothlet.hook.enable({ id: hookId });
		await api.math.add(1, 2);
		expect(handlerSpy).toHaveBeenCalledOnce(); // enabled again
	});

	it("disabled 'after:**' pattern hook skipped in after subsection (line 404)", async () => {
		const afterSpy = vi.fn();
		const hookId = api.slothlet.hook.on("after:**", afterSpy);

		// Verify fires while enabled
		await api.math.add(1, 2);
		expect(afterSpy).toHaveBeenCalled();
		afterSpy.mockClear();

		// Disable and verify skip
		api.slothlet.hook.disable({ id: hookId });
		await api.math.add(1, 2);
		expect(afterSpy).not.toHaveBeenCalled();
	});

	it("multiple pattern hooks — disabled are skipped, enabled ones still fire (line 404)", async () => {
		const spy1 = vi.fn();
		const spy2 = vi.fn();

		const id1 = api.slothlet.hook.on("before:**", spy1);
		const id2 = api.slothlet.hook.on("before:**", spy2);

		// Disable only the first hook
		api.slothlet.hook.disable({ id: id1 });

		await api.math.add(1, 2);

		// spy1 disabled → skipped (line 404)
		expect(spy1).not.toHaveBeenCalled();
		// spy2 still enabled → fires
		expect(spy2).toHaveBeenCalled();
	});
});
