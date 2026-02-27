/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-manager-branches.test.vitest.mjs
 *	@Date: 2026-02-26T00:00:00-08:00 (1772064000)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-26 00:00:00 -08:00 (1772064000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for HookManager uncovered branches (lines 377, 949).
 *
 * @description
 * - Line 377: `getHooksForPath()` fast-path when hooks are globally disabled
 *   (`config.hook.enabled === false`). Every wrapped function call invokes
 *   `getHooksForPath`; with hooks disabled the very first check returns `[]`.
 *
 * - Line 949: `importHooks()` — the `if (!reg.enabled)` branch fires when a
 *   previously-disabled hook is restored after `reload()`. The `exportHooks →
 *   importHooks` round-trip happens automatically when hooks are enabled and a
 *   reload is triggered.
 *
 * Both tests drive behaviour entirely through the public slothlet API.
 *
 * @module tests/vitests/suites/hooks/hook-manager-branches.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── shared lifecycle ─────────────────────────────────────────────────────────

let api;

afterEach(async () => {
	if (api) {
		await api.slothlet.shutdown();
		api = null;
	}
});

// ─── Line 377: getHooksForPath fast-path — hooks globally disabled ────────────

describe("HookManager.getHooksForPath — hooks disabled fast-path (line 377)", () => {
	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			hook: false,
			api: { collision: { initial: "replace", api: "replace" } }
		});
	});

	it("returns a result without throwing when hooks are disabled and API function is called", async () => {
		// Any API call exercises the hook path; with hook:false line 377 fires and
		// returns [] immediately without iterating hooks.
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);
	});

	it("registered hooks are never invoked when hook:false (fast-path at line 377 skips all hooks)", async () => {
		// Register a hook — it is stored, but getHooksForPath returns [] early at line 377
		let hookCalled = false;
		api.slothlet.hook.on("before:**", () => {
			hookCalled = true;
		});

		await api.math.add(2, 3);
		// Hook must NOT have fired because the fast-path returned [] without iterating
		expect(hookCalled).toBe(false);
	});
});

// ─── Line 949: importHooks disabled branch — reload restores disabled hook ───

describe("HookManager.importHooks — restores disabled hook on reload (line 949)", () => {
	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			hook: { enabled: true },
			api: { collision: { initial: "replace", api: "replace" } }
		});
	});

	it("disabled hook is re-registered in disabled state after reload (line 949)", async () => {
		// 1. Register a hook and capture its ID
		const hookId = api.slothlet.hook.on("before:**", () => {});
		expect(typeof hookId).toBe("string");

		// 2. Disable it — exportHooks will capture enabled: false
		api.slothlet.hook.disable({ id: hookId });

		const listBefore = api.slothlet.hook.list();
		const hookBefore = listBefore.registeredHooks.find((h) => h.id === hookId);
		expect(hookBefore?.enabled).toBe(false);

		// 3. Reload — exportHooks → importHooks round-trip; line 949 fires
		await api.slothlet.reload();

		// 4. The hook should still exist in disabled state
		const listAfter = api.slothlet.hook.list();
		// A matching disabled hook should be present (same typePattern)
		const disabledHook = listAfter.registeredHooks.find((h) => !h.enabled);
		expect(disabledHook).toBeDefined();
	});

	it("enabled hook survives reload and remains enabled (no line 949 branch taken)", async () => {
		// Contrast case: enabled hook should not trigger the disable branch
		const hookId = api.slothlet.hook.on("before:**", () => {});

		await api.slothlet.reload();

		const listAfter = api.slothlet.hook.list();
		const enabledHook = listAfter.registeredHooks.find((h) => h.enabled);
		expect(enabledHook).toBeDefined();
	});
});
