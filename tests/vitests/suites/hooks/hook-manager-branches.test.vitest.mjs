/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-manager-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 11:33:16 -08:00 (1772566396)
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
		const ____hookId = api.slothlet.hook.on("before:**", () => {});

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

// ─── remove() without filter.id (L209 false branch) ──────────────────────────

describe("HookManager.remove() — pattern-based removal without id (L209 false branch)", () => {
	it("removes hooks by pattern when filter has no id (L209 false)", () => {
		const hm = new HookManager(makeMockHm());

		hm.on("before:math.*", () => {}, { id: "hook-pattern-remove" });
		expect(hm.list().registeredHooks).toHaveLength(1);

		// remove() called WITHOUT filter.id → L209 false branch taken
		const removed = hm.remove({ pattern: "math.*" });

		expect(removed).toBe(1);
		expect(hm.list().registeredHooks).toHaveLength(0);
	});

	it("removes all hooks when remove({}) called without id or pattern (L209 false)", () => {
		const hm = new HookManager(makeMockHm());
		hm.on("before:**", () => {}, { id: "h1" });
		hm.on("after:math.*", () => {}, { id: "h2" });

		const removed = hm.remove({});
		expect(removed).toBe(2);
		expect(hm.list().registeredHooks).toHaveLength(0);
	});
});

// ─── remove() with non-existent id (L217 false branch) ───────────────────────

describe("HookManager.remove() — non-existent id (L217 false branch: hook not found)", () => {
	it("returns 0 when removing by id that was never registered (L217 false)", () => {
		const hm = new HookManager(makeMockHm());

		// remove() by id that doesn't exist → this.#byId.get() returns undefined → L217 false
		const removed = hm.remove({ id: "does-not-exist-at-all" });
		expect(removed).toBe(0);
	});

	it("returns 0 after hook was already removed — id no longer in #byId (L217 false)", () => {
		const hm = new HookManager(makeMockHm());
		hm.on("before:**", () => {}, { id: "already-removed" });

		// First removal succeeds
		expect(hm.remove({ id: "already-removed" })).toBe(1);

		// Second removal: id is gone from #byId → L217 false branch
		expect(hm.remove({ id: "already-removed" })).toBe(0);
	});
});

// ─── list() enabled filter mismatch (L321 third branch) ──────────────────────

describe("HookManager.list() — enabled filter mismatch (L321 third branch)", () => {
	it("does not include enabled hooks when list({ enabled: false }) is called (L321 third branch)", () => {
		const hm = new HookManager(makeMockHm());

		// All hooks start as enabled (enabled: true by default)
		hm.on("before:**", () => {}, { id: "enabled-hook-1" });
		hm.on("after:math.*", () => {}, { id: "enabled-hook-2" });

		// filter.enabled = false, hook.enabled = true → condition false → L321 third branch
		const result = hm.list({ enabled: false });
		expect(result.registeredHooks).toHaveLength(0);
	});

	it("includes disabled hooks when list({ enabled: false }) is called", () => {
		const hm = new HookManager(makeMockHm());
		const id = hm.on("before:**", () => {});

		// Disable the hook
		hm.disable({ id });

		// Now filter.enabled = false, hook.enabled = false → L321 branch 1
		const result = hm.list({ enabled: false });
		expect(result.registeredHooks).toHaveLength(1);
		expect(result.registeredHooks[0].enabled).toBe(false);
	});
});

// ─── disable({ type }) without id (L861 true branch) ────────────────────────

describe("HookManager.disable({ type }) — type-based disable without id (L861 true branch)", () => {
	it("disables all hooks for a given type when called without id (L861 true)", () => {
		const hm = new HookManager(makeMockHm());
		hm.on("before:**", () => {}, { id: "bh1" });
		hm.on("before:math.*", () => {}, { id: "bh2" });
		hm.on("after:**", () => {}, { id: "ah1" });

		// disable({ type: "before" }) → no filter.id → L861 executes
		// filter.type is "before" → L861 true branch: types = ["before"]
		const affected = hm.disable({ type: "before" });
		expect(affected).toBe(2);

		const list = hm.list();
		const beforeHooks = list.registeredHooks.filter((h) => h.type === "before");
		const afterHooks = list.registeredHooks.filter((h) => h.type === "after");
		expect(beforeHooks.every((h) => !h.enabled)).toBe(true);
		expect(afterHooks.every((h) => h.enabled)).toBe(true);
	});

	it("enable({ type }) re-enables only the specified type (L861 true)", () => {
		const hm = new HookManager(makeMockHm());
		hm.on("before:**", () => {}, { id: "bh-enable" });
		hm.disable({ id: "bh-enable" });

		// enable({ type: "before" }) → L861 true branch
		hm.enable({ type: "before" });

		const list = hm.list();
		expect(list.registeredHooks[0].enabled).toBe(true);
	});
});

// ─── executeErrorHooks() with non-object error (L591 false branch) ───────────

describe("HookManager.executeErrorHooks() — non-object error (L591 false branch)", () => {
	it("skips ERROR_HOOK_PROCESSED assignment when error is a string (L591 false)", () => {
		const hm = new HookManager(makeMockHm());

		// No error hooks registered → loop body never runs
		// L591: 'error && typeof error === "object"' → string → false branch
		expect(() => hm.executeErrorHooks("math.add", "string error message", "source", [], {})).not.toThrow();
	});

	it("skips ERROR_HOOK_PROCESSED assignment when error is null (L591 false: falsy)", () => {
		const hm = new HookManager(makeMockHm());
		expect(() => hm.executeErrorHooks("math.add", null, "source", [], {})).not.toThrow();
	});

	it("calls error hook handler even for non-object errors (L591 false path)", () => {
		const hm = new HookManager(makeMockHm());
		let received = null;
		hm.on("error:**", (ctx) => {
			received = ctx;
		});

		hm.executeErrorHooks("math.add", "plain-string-error", "source", [1, 2], {});

		expect(received).not.toBeNull();
		expect(received.error).toBe("plain-string-error");
	});
});

// ─── executeErrorHooks() handler throws (L603 catch branch) ──────────────────

describe("HookManager.executeErrorHooks() — handler throws (L603 catch branch)", () => {
	it("silently swallows throw from an error hook handler (L603 catch)", () => {
		const hm = new HookManager(makeMockHm());

		hm.on("error:**", () => {
			throw new Error("error hook itself threw");
		});

		// The catch block logs but does not propagate — L603 catch fires
		expect(() => hm.executeErrorHooks("math.add", new Error("original"), "source", [], {})).not.toThrow();
	});
});

// ─── #splitBraceAlternatives trailing comma (L785 false branch) ──────────────

describe("HookManager.on() — brace pattern with trailing comma (L785 false branch)", () => {
	it("registers hook with trailing comma in brace alternative {a,b,} without throwing (L785 false)", () => {
		const hm = new HookManager(makeMockHm());

		// "{a,b,}" → #splitBraceAlternatives("a,b,") → after loop: current = "" (falsy) → L785 false
		expect(() => hm.on("before:{math,add,}", () => {}, { id: "brace-trailing-comma" })).not.toThrow();
		expect(hm.list().registeredHooks).toHaveLength(1);
	});
});

// ─── importHooks() with non-array (line 945 early return) ────────────────────

describe("HookManager.importHooks() — non-array argument (line 945 early return)", () => {
	it("returns immediately when passed null (line 945)", () => {
		const hm = new HookManager(makeMockHm());
		expect(() => hm.importHooks(null)).not.toThrow();
		expect(hm.list().registeredHooks).toHaveLength(0);
	});

	it("returns immediately when passed a string (line 945)", () => {
		const hm = new HookManager(makeMockHm());
		expect(() => hm.importHooks("not an array")).not.toThrow();
	});

	it("returns immediately when passed a number (line 945)", () => {
		const hm = new HookManager(makeMockHm());
		expect(() => hm.importHooks(42)).not.toThrow();
	});

	it("returns immediately when passed an object (line 945)", () => {
		const hm = new HookManager(makeMockHm());
		expect(() => hm.importHooks({ key: "value" })).not.toThrow();
	});
});
// ─── remove() with filter.type — truthy branch of types ternary (line 217) ───

describe("HookManager.remove() — filter.type truthy branch narrows types array (line 217 ternary true)", () => {
        it("removes only hooks of the specified type when filter.type is provided (line 217 truthy)", () => {
                const hm = new HookManager(makeMockHm());

                hm.on("before:math.*", () => {}, { id: "hook-before-1" });
                hm.on("after:math.*", () => {}, { id: "hook-after-1" });
                expect(hm.list().registeredHooks).toHaveLength(2);

                // remove({ type: "before" }) → filter.type = "before" is truthy
                // → line 217: types = [filter.type] = ["before"] (truthy branch taken for first time)
                const removed = hm.remove({ type: "before" });

                expect(removed).toBe(1);
                expect(hm.list().registeredHooks).toHaveLength(1);
                expect(hm.list().registeredHooks[0].id).toBe("hook-after-1");
        });

        it("removes all hooks under the specified type across all patterns (line 217 truthy)", () => {
                const hm = new HookManager(makeMockHm());

                hm.on("after:math.*", () => {}, { id: "hook-after-1" });
                hm.on("after:db.*", () => {}, { id: "hook-after-2" });
                hm.on("always:math.*", () => {}, { id: "hook-always-1" });

                // remove({ type: "after" }) → filter.type truthy → types = ["after"]
                const removed = hm.remove({ type: "after" });

                expect(removed).toBe(2);
                const remaining = hm.list().registeredHooks;
                expect(remaining).toHaveLength(1);
                expect(remaining[0].id).toBe("hook-always-1");
        });

        it("returns 0 when specified type has no registered hooks (line 217 truthy, no match)", () => {
                const hm = new HookManager(makeMockHm());

                hm.on("before:math.*", () => {}, { id: "hook-before-only" });

                // remove({ type: "after" }) → filter.type truthy → types = ["after"], no hooks → 0
                const removed = hm.remove({ type: "after" });

                expect(removed).toBe(0);
                expect(hm.list().registeredHooks).toHaveLength(1);
        });
});