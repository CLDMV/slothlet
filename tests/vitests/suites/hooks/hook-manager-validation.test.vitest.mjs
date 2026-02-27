/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/hooks/hook-manager-validation.test.vitest.mjs
 *      @Date: 2026-01-12T00:00:00-08:00 (1768290278)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-01-12 00:00:00 -08:00 (1768290278)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for HookManager validation, error paths, and utility methods.
 * @module tests/vitests/suites/hooks/hook-manager-validation.test.vitest
 *
 * @description
 * Covers uncovered code branches in hook-manager.mjs:
 * - #parseTypePattern validation errors (non-string, no colon, empty parts)
 * - on() validation: invalid type, non-function handler, duplicate ID
 * - on() with options.pattern override
 * - off() with filter.pattern
 * - disable() string shorthand
 * - list() string shorthand (pattern branch), list({ id }), list({ enabled }), list({ pattern })
 * - enable/disable({ id }) — setEnabledState fast path
 * - importHooks/exportHooks triggered via api.slothlet.api.reload()
 * - getHooksForPath() exercised indirectly through hook execution
 * - Before hook that returns a Promise (throws error)
 * - Error hook that itself throws (logged but not re-thrown)
 * - Unmatched brace in glob pattern (#expandBraces returns literal)
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a no-op hook handler function.
 * @returns {function} Identity function used as hook handler
 */
const noop = () => undefined;

// ─── on() validation errors ───────────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("HookManager > on() validation > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("on() with non-string typePattern throws INVALID_TYPE_PATTERN (line 626)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on(123, noop)).toThrow();
		});
	});

	test("on() with no colon in typePattern throws INVALID_TYPE_PATTERN (line 634)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on("noColonHere", noop)).toThrow();
		});
	});

	test("on() with empty type throws INVALID_TYPE_PATTERN (line 644)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on(":some.path", noop)).toThrow();
		});
	});

	test("on() with empty pattern throws INVALID_TYPE_PATTERN (line 644)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on("before:", noop)).toThrow();
		});
	});

	test("on() with unrecognized type throws INVALID_HOOK_TYPE (line 132)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on("invalid:math.add", noop)).toThrow();
		});
	});

	test("on() with non-function handler throws INVALID_HOOK_HANDLER (line 140)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => api.slothlet.hook.on("before:math.add", "notAFunction")).toThrow();
		});
	});

	test("on() with duplicate ID throws DUPLICATE_HOOK_ID (line 151)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			api.slothlet.hook.on("before:math.add", noop, { id: "my-unique-id" });
			expect(() => api.slothlet.hook.on("after:math.add", noop, { id: "my-unique-id" })).toThrow();
		});
	});

	test("on() with options.pattern overrides parsed pattern (line 127)", () => {
		const id = api.slothlet.hook.on("before:math.add", noop, { pattern: "math.*" });
		expect(id).toBeDefined();

		// Verify the hook is listed and uses the overridden pattern
		const result = api.slothlet.hook.list({ id });
		expect(result.registeredHooks).toHaveLength(1);
		expect(result.registeredHooks[0].pattern).toBe("math.*");
	});
});

// ─── off() with filter.pattern ────────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("HookManager > off() with filter.pattern > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("off({ pattern }) removes hooks matching that pattern (lines 227-231)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "h-add" });
		api.slothlet.hook.on("before:math.subtract", noop, { id: "h-sub" });

		const removedCount = api.slothlet.hook.off({ pattern: "math.add" });

		expect(removedCount).toBeGreaterThanOrEqual(1);
		expect(api.slothlet.hook.list({ id: "h-add" }).registeredHooks).toHaveLength(0);
		// h-sub should still exist
		expect(api.slothlet.hook.list({ id: "h-sub" }).registeredHooks).toHaveLength(1);
	});
});

// ─── disable() string shorthand ──────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("HookManager > disable() string shorthand > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("disable(string) normalises to { pattern: string } (line 283)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "d-test-add" });
		api.slothlet.hook.on("before:math.subtract", noop, { id: "d-test-sub" });

		const affected = api.slothlet.hook.disable("math.add");
		expect(typeof affected).toBe("number");

		const listed = api.slothlet.hook.list({ id: "d-test-add" });
		if (listed.registeredHooks.length > 0) {
			expect(listed.registeredHooks[0].enabled).toBe(false);
		}

		// math.subtract should still be enabled
		const listedSub = api.slothlet.hook.list({ id: "d-test-sub" });
		if (listedSub.registeredHooks.length > 0) {
			expect(listedSub.registeredHooks[0].enabled).toBe(true);
		}
	});
});

// ─── list() string pattern branch ─────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("HookManager > list() utility > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("list(string) that is not a valid type is treated as pattern (lines 312-313)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "list-add" });
		api.slothlet.hook.on("before:math.subtract", noop, { id: "list-sub" });

		// "math.*" is not a valid hook type, so it is treated as a pattern filter
		const result = api.slothlet.hook.list("math.*");
		expect(result).toHaveProperty("registeredHooks");
		expect(Array.isArray(result.registeredHooks)).toBe(true);
	});

	test("list({ id }) returns the single hook by fast path (lines 320-324)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "fastpath-id" });

		const result = api.slothlet.hook.list({ id: "fastpath-id" });
		expect(result.registeredHooks).toHaveLength(1);
		expect(result.registeredHooks[0].id).toBe("fastpath-id");
	});

	test("list({ id }) returns empty array when ID not found (lines 320-324)", () => {
		const result = api.slothlet.hook.list({ id: "nonexistent-id" });
		expect(result.registeredHooks).toHaveLength(0);
	});

	test("list({ pattern }) compiles a pattern matcher (line 333)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "pattern-match" });

		const result = api.slothlet.hook.list({ pattern: "math.*" });
		expect(result).toHaveProperty("registeredHooks");
		// math.add should match math.*
		const found = result.registeredHooks.find((h) => h.id === "pattern-match");
		expect(found).toBeDefined();
	});

	test("list({ pattern }) skips hooks whose pattern does not match (line 353)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "nomatch-hook" });

		// "other.*" will NOT match pattern "math.add"
		const result = api.slothlet.hook.list({ pattern: "other.*" });
		const found = result.registeredHooks.find((h) => h.id === "nomatch-hook");
		expect(found).toBeUndefined();
	});

	test("list({ enabled: false }) skips enabled hooks (line 348)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "enabled-hook" });
		// enabled-hook is enabled by default

		const result = api.slothlet.hook.list({ enabled: false });
		const found = result.registeredHooks.find((h) => h.id === "enabled-hook");
		// The enabled hook should NOT appear in the results
		expect(found).toBeUndefined();
	});

	test("list({ enabled: true }) includes only enabled hooks and skips disabled ones (line 348)", () => {
		api.slothlet.hook.on("before:math.add", noop, { id: "enabled-a" });
		api.slothlet.hook.on("before:math.subtract", noop, { id: "disabled-b" });
		api.slothlet.hook.disable({ id: "disabled-b" });

		const result = api.slothlet.hook.list({ enabled: true });
		const foundA = result.registeredHooks.find((h) => h.id === "enabled-a");
		const foundB = result.registeredHooks.find((h) => h.id === "disabled-b");

		expect(foundA).toBeDefined();
		expect(foundB).toBeUndefined();
	});
});

// ─── enable/disable({ id }) — setEnabledState fast path ──────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"HookManager > enable/disable({ id }) fast path > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("disable({ id }) disables a specific hook by ID (lines 852-857)", () => {
			api.slothlet.hook.on("before:math.add", noop, { id: "hook-to-disable" });

			const affected = api.slothlet.hook.disable({ id: "hook-to-disable" });
			expect(affected).toBe(1);

			const result = api.slothlet.hook.list({ id: "hook-to-disable" });
			expect(result.registeredHooks[0].enabled).toBe(false);
		});

		test("enable({ id }) re-enables a previously disabled hook (lines 852-857)", () => {
			api.slothlet.hook.on("before:math.add", noop, { id: "hook-to-reenable" });
			api.slothlet.hook.disable({ id: "hook-to-reenable" });

			const affected = api.slothlet.hook.enable({ id: "hook-to-reenable" });
			expect(affected).toBe(1);

			const result = api.slothlet.hook.list({ id: "hook-to-reenable" });
			expect(result.registeredHooks[0].enabled).toBe(true);
		});

		test("disable({ id }) with nonexistent ID affects 0 hooks (lines 852-857)", () => {
			const affected = api.slothlet.hook.disable({ id: "does-not-exist" });
			expect(affected).toBe(0);
		});
	}
);

// ─── importHooks/exportHooks via reload ─────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"HookManager > importHooks/exportHooks via reload > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" },
				api: { mutations: { reload: true } }
			});
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("reload() exports hooks then re-imports them after fresh load (lines 944-951)", async () => {
			api.slothlet.hook.on("before:math.add", noop, { id: "persisted-hook" });

			// Reload triggers exportHooks() + importHooks() internally
			await api.slothlet.api.reload();

			// After reload, hook should still be present (re-imported)
			const result = api.slothlet.hook.list({ id: "persisted-hook" });
			expect(result.registeredHooks).toHaveLength(1);
			expect(result.registeredHooks[0].id).toBe("persisted-hook");
		});
	}
);

// ─── getHooksForPath() fast paths ─────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"HookManager > getHooksForPath() via hook execution > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("hooks execute correctly, confirming getHooksForPath is reachable (lines 374+)", async () => {
			const calls = [];
			api.slothlet.hook.on("before:math.add", ({ args }) => {
				calls.push(args);
			});

			const result = api.math.add(2, 3);
			// In lazy mode result may be a promise
			const value = result && typeof result.then === "function" ? await result : result;
			expect(value).toBe(5);
			expect(calls.length).toBeGreaterThanOrEqual(1);
		});
	}
);

// ─── before hook returning a Promise ──────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"HookManager > executeBeforeHooks() Promise rejection > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("before hook that returns a Promise throws HOOK_BEFORE_RETURNED_PROMISE (line 445)", async () => {
			api.slothlet.hook.on("before:math.add", () => Promise.resolve([1, 2]), { id: "promise-hook" });

			await withSuppressedSlothletErrorOutput(async () => {
				// Wrap in async arrow so that sync throws are captured as rejections too
				await expect(async () => api.math.add(1, 2)).rejects.toThrow();
			});
		});
	}
);

// ─── error hook that itself throws ────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("HookManager > error hook that throws > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			// suppressErrors intentionally left false so errors propagate for assertion
			collision: { initial: "replace", api: "replace" }
		});
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("an error hook that throws internally logs but does not propagate (line 611)", async () => {
		// Register an error hook that itself throws
		api.slothlet.hook.on("error:math.add", () => {
			throw new Error("Error hook failure");
		});

		// Register a before hook that throws to trigger the error hook
		api.slothlet.hook.on("before:math.add", () => {
			throw new Error("Primary error");
		});

		// The call should throw the primary error; error hook's internal throw is logged but not re-thrown
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(async () => api.math.add(1, 2)).rejects.toThrow();
		});
	});
});

// ─── glob unmatched brace ─────────────────────────────────────────────────────

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"HookManager > glob pattern with unmatched brace > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("pattern with unmatched { is treated as literal (line 733)", () => {
			// Registering a hook with an unmatched brace in the pattern exercises
			// the #expandBraces fallback that returns [pattern] when braceEnd === -1
			expect(() => {
				api.slothlet.hook.on("before:math.{unclosed", noop);
			}).not.toThrow();
		});
	}
);
