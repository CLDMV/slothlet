/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/hooks/unified-wrapper-coverage-b-around-short-circuit.test.vitest.mjs
 *	@Date: 2026-11-25T01:38:42-08:00 (1795599522)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:56-08:00 (1795869116)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call on a path with an `around` hook: a `before` hook's short-circuit, sync or async, and a lazy
 * node called before it has loaded.
 *
 * @description
 * Fixture `api_test_uwb_hooks`:
 * ```
 * math.mjs        add(a, b) (sync), mul(a, b) (async)
 * tool/tool.mjs   default tool(x) -> "tool:" + x  (the folder's own function)
 * tool/extra.mjs  value = 1
 * ```
 * With a pass-through `around` hook on every path, a `before` hook that returns a non-array value is the call's result
 * (docs/HOOKS.md, "Short-Circuit Execution"), and a lazy folder's function called before the folder loaded loads it
 * and runs.
 *
 * @module tests/vitests/suites/hooks/unified-wrapper-coverage-b-around-short-circuit
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_hooks", import.meta.url).pathname;

describe.each([["eager"], ["lazy"]])("around hook pipeline (%s)", (mode) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("runs a folder's function through the around hook, loading it first when lazy", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, hook: { enabled: true } });
		api.slothlet.hook.on("**:around", ({ next }) => next());
		expect(await api.tool("x")).toBe("tool:x");
	});

	it("returns a sync before hook's short-circuit value", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, hook: { enabled: true } });
		api.slothlet.hook.on("**:around", ({ next }) => next());
		api.slothlet.hook.on("math.add:before", () => "short");
		expect(await api.math.add(1, 2)).toBe("short");
	});

	it("returns an async before hook's short-circuit value", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, hook: { enabled: true } });
		api.slothlet.hook.on("**:around", ({ next }) => next());
		api.slothlet.hook.on("math.mul:before", async () => "async-short");
		expect(await api.math.mul(2, 3)).toBe("async-short");
	});

	it("runs the function when no before hook short-circuits", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, hook: { enabled: true } });
		api.slothlet.hook.on("**:around", ({ next }) => next());
		expect(await api.math.add(1, 2)).toBe(3);
		expect(await api.math.mul(2, 3)).toBe(6);
	});
});
