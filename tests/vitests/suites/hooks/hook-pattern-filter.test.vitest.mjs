/**
 * @fileoverview Regression + feature tests for #125 — the global hook pattern filter.
 *
 * @description
 * `hook.pattern` (and the boolean/string `hook` forms that derive it) is documented as a global
 * filter controlling which API paths hooks apply to ("Only intercept database functions by
 * default"). It was parsed and stored on the HookManager but never read at runtime, so it
 * silently filtered nothing. These tests assert it now genuinely gates hook execution by API
 * path — both the static config form and the runtime `enablePattern`/`disablePattern`/
 * `resetPatternFilter` methods — for matching and non-matching paths.
 *
 * @module tests/vitests/suites/hooks/hook-pattern-filter.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hook pattern filter (#125) > Config: '$name'", ({ config }) => {
	let api;

	/**
	 * Boot an API for the current matrix config with a specific hook override.
	 * @param {object|string} hook - The `hook` config value to apply.
	 * @returns {Promise<object>} Bound API instance.
	 */
	async function createApi(hook) {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, hook });
		return api;
	}

	/**
	 * Register a catch-all before hook that records every path it fires for.
	 * @returns {string[]} A live array of fired API paths.
	 */
	function recordFiredPaths() {
		const fired = [];
		api.slothlet.hook.on("before:**", ({ path }) => {
			fired.push(path);
		});
		return fired;
	}

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("a non-matching global pattern suppresses ALL hooks (the #125 repro)", async () => {
		await createApi({ enabled: true, pattern: "does.not.exist" });
		let fired = false;
		api.slothlet.hook.on("before:math.add", () => {
			fired = true;
		});
		await api.math.add(1, 2);
		expect(fired).toBe(false);
	});

	it("a global pattern restricts hooks to matching paths only", async () => {
		await createApi({ enabled: true, pattern: "math.*" });
		const fired = recordFiredPaths();

		await api.math.add(1, 2);
		await api.string.upper("x");

		// math.add matches "math.*"; string.upper does not.
		expect(fired).toContain("math.add");
		expect(fired).not.toContain("string.upper");
	});

	it("the catch-all pattern '**' does not restrict anything (backward compatible)", async () => {
		await createApi({ enabled: true, pattern: "**" });
		const fired = recordFiredPaths();

		await api.math.add(1, 2);
		await api.string.upper("x");

		expect(fired).toContain("math.add");
		expect(fired).toContain("string.upper");
	});

	it("the string hook form sets the global pattern filter", async () => {
		await createApi("math.*");
		const fired = recordFiredPaths();

		await api.math.add(1, 2);
		await api.string.upper("x");

		expect(fired).toContain("math.add");
		expect(fired).not.toContain("string.upper");
	});

	it("enablePattern restricts at runtime, disablePattern lifts it", async () => {
		await createApi({ enabled: true, pattern: "**" });
		const fired = recordFiredPaths();

		// Restrict to math.* at runtime.
		api.slothlet.hook.enablePattern("math.*");
		await api.math.add(1, 2);
		await api.string.upper("x");
		expect(fired).toContain("math.add");
		expect(fired).not.toContain("string.upper");

		// Lift the restriction — string.* fires again.
		fired.length = 0;
		api.slothlet.hook.disablePattern("math.*");
		await api.math.add(1, 2);
		await api.string.upper("x");
		expect(fired).toContain("math.add");
		expect(fired).toContain("string.upper");
	});

	it("disablePattern with multiple active patterns keeps the remaining filter", async () => {
		await createApi({ enabled: true, pattern: "**" });
		const fired = recordFiredPaths();

		// Two active patterns; removing one leaves the filter active with the other.
		api.slothlet.hook.enablePattern("math.*");
		api.slothlet.hook.enablePattern("string.*");
		api.slothlet.hook.disablePattern("string.*");

		await api.math.add(1, 2);
		await api.string.upper("x");
		expect(fired).toContain("math.add");
		expect(fired).not.toContain("string.upper");
	});

	it("resetPatternFilter with a '**' default returns to fully unrestricted", async () => {
		await createApi({ enabled: true, pattern: "**" });
		const fired = recordFiredPaths();

		// Restrict at runtime, then reset — the configured default is the catch-all,
		// so reset leaves the filter inactive (every path fires again).
		api.slothlet.hook.enablePattern("math.*");
		api.slothlet.hook.resetPatternFilter();

		await api.math.add(1, 2);
		await api.string.upper("x");
		expect(fired).toContain("math.add");
		expect(fired).toContain("string.upper");
	});

	it("resetPatternFilter reverts runtime changes to the configured default", async () => {
		await createApi({ enabled: true, pattern: "math.*" });
		const fired = recordFiredPaths();

		// Widen at runtime so everything fires...
		api.slothlet.hook.enablePattern("**");
		await api.string.upper("x");
		expect(fired).toContain("string.upper");

		// ...then reset back to the configured "math.*" default.
		fired.length = 0;
		api.slothlet.hook.resetPatternFilter();
		await api.math.add(1, 2);
		await api.string.upper("x");
		expect(fired).toContain("math.add");
		expect(fired).not.toContain("string.upper");
	});
});
