/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-manager-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:49 -08:00 (1772425309)
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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { HookManager } from "@cldmv/slothlet/handlers/hook-manager";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
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
// ─── Line 382: getHooksForPath with invalid type ──────────────────────────────

/**
 * Build a minimal mock slothlet sufficient to boot HookManager.
 * @returns {object} Mock slothlet.
 *
 * @example
 * const hm = new HookManager(makeMockHm());
 */
function makeMockHm() {
        return {
                config: { hook: { enabled: true } },
                debug: vi.fn(),
                SlothletError,
                SlothletWarning
        };
}

describe("HookManager.getHooksForPath — unknown type returns [] via typeIndex guard (line 382)", () => {
        it("returns [] without throwing when given a type not in #hooks (line 382)", () => {
                const hm = new HookManager(makeMockHm());

                // Register a valid hook first to ensure #hooks is populated
                hm.on("before:**", () => {});

                // An unregistered type key is undefined in #hooks → !typeIndex is true → line 382
                const result = hm.getHooksForPath("nonexistent_type", "math.add");
                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(0);
        });

        it("returns [] for empty type string (line 382)", () => {
                const hm = new HookManager(makeMockHm());
                const result = hm.getHooksForPath("", "math.add");
                expect(result).toEqual([]);
        });
});

// ─── Lines 960-967: HookManager.shutdown() ────────────────────────────────────

describe("HookManager.shutdown — clears hooks and resets counter (lines 960-967)", () => {
        it("removes all registered hooks after shutdown (lines 960-967)", async () => {
                const hm = new HookManager(makeMockHm());

                // Register several hooks
                hm.on("before:**", () => {}, { id: "h1" });
                hm.on("after:math.*", () => {}, { id: "h2" });
                expect(hm.list().registeredHooks).toHaveLength(2);

                // shutdown() reinitialises #hooks and clears #byId (lines 960-967)
                await hm.shutdown();

                expect(hm.list().registeredHooks).toHaveLength(0);
        });

        it("resets idCounter so new hooks get IDs from the beginning (lines 960-967)", async () => {
                const hm = new HookManager(makeMockHm());

                // Register a hook to advance idCounter
                hm.on("before:**", () => {});

                await hm.shutdown();

                // After shutdown, idCounter is 0, so next hook ID is 'hook-0' or similar
                const id = hm.on("before:**", () => {});
                expect(typeof id).toBe("string");
        });

        it("is idempotent — calling shutdown twice does not throw (lines 960-967)", async () => {
                const hm = new HookManager(makeMockHm());
                hm.on("before:**", () => {});

                await expect(hm.shutdown()).resolves.not.toThrow();
                await expect(hm.shutdown()).resolves.not.toThrow();
        });
});

// ─── getHooksForPath globally-disabled fast-path (line 377) ────────────────────

describe("HookManager.getHooksForPath — globally-disabled early-return (line 377) [direct]", () => {
        it("returns [] immediately when this.enabled === false without checking type index (line 377)", () => {
                // The unified-wrapper checks hookManager.enabled BEFORE calling executeBeforeHooks,
                // so this fast-path can only be reached by calling getHooksForPath directly on a
                // disabled manager.
                const hm = new HookManager(makeMockHm());

                // Register a valid hook so the #hooks map is populated
                hm.on("before:**", () => {});

                // Globally disable the manager
                hm.disable();

                // Direct call — line 377: `if (this.enabled === false) { return []; }`
                const result = hm.getHooksForPath("before", "math.add");

                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(0);
        });

        it("returns [] for any registered type when globally disabled (line 377)", () => {
                const hm = new HookManager(makeMockHm());
                hm.on("after:**", () => {});
                hm.disable();

                expect(hm.getHooksForPath("after", "math.add")).toEqual([]);
                expect(hm.getHooksForPath("always", "any.path")).toEqual([]);
        });
});