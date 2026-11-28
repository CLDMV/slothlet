/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/hooks/hook-namespace-gating.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:53-08:00 (1795869113)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.hook` exists on every instance (#821). The `hook` option only sets whether hooks start
 * enabled; `api.slothlet.hook.enable()` turns them on at runtime, so the namespace can't depend on the starting state.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("api.slothlet.hook is on every instance (#821) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("is present when hooks are off", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});

	it("is present for hook: false", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, hook: false });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});

	describe.each([
		["no hook option", undefined],
		["hook: false", false],
		["hook: { enabled: false }", { enabled: false }]
	])("enabling at runtime with %s", (_label, hook) => {
		it("fires registered hooks only after enable()", async () => {
			const options = { base: TEST_DIRS.API_TEST, mode };
			if (hook !== undefined) options.hook = hook;
			api = await slothlet(options);
			let fired = 0;
			api.slothlet.hook.on("math.add:before", () => {
				fired++;
			});
			const expected = await api.math.add(2, 3);
			expect(fired).toBe(0);
			api.slothlet.hook.enable();
			expect(await api.math.add(2, 3)).toBe(expected);
			expect(fired).toBe(1);
		});
	});

	it("is present when hooks are enabled", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, hook: true });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});

	it("is present with diagnostics even when hooks are off", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, diagnostics: true });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});
});
