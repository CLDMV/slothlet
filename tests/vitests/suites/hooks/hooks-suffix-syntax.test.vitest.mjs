/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-suffix-syntax.test.vitest.mjs
 *	@Date: 2026-06-01T23:15:57-07:00 (1780380957)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T22:53:48-08:00 (1794812028)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hook registration syntax (#118): the suffix form `pattern:type` (e.g. `"math.add:before"`)
 * is the only form. A type-first string (`"before:math.add"`) names no hook type at its end and is
 * refused with `INVALID_TYPE_PATTERN`.
 *
 * @module tests/vitests/suites/hooks/hooks-suffix-syntax
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

describe.each(getMatrixConfigs())("Hooks > suffix syntax (#118) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("suffix `pattern:type` registers and fires", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		let seen = null;
		api.slothlet.hook.on("math.add:before", ({ path }) => {
			seen = path;
		});
		await api.math.add(2, 3);
		expect(seen).toBe("math.add");
	});

	it("refuses a type-first `type:pattern` string", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		expect(() => api.slothlet.hook.on("before:math.add", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("suffix interpretation wins for an ambiguous `type:type` input", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		const id = api.slothlet.hook.on("before:after", () => {});
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].type).toBe("after"); // trailing token wins
		expect(registeredHooks[0].pattern).toBe("before"); // path pattern is "before"
	});

	it("rejects a pattern with no colon", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		expect(() => api.slothlet.hook.on("math.add", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects a pattern whose ends are not a hook type", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		expect(() => api.slothlet.hook.on("foo:bar", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects an empty path pattern, and a type with no pattern after it", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		expect(() => api.slothlet.hook.on(":before", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
		expect(() => api.slothlet.hook.on("before:", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects a non-string typePattern", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true });
		expect(() => api.slothlet.hook.on(123, () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("reload re-registers hooks in suffix form", async () => {
		api = await slothlet({ ...config, base: BASE, diagnostics: true, hook: true, api: { mutations: { reload: true } } });
		const id = api.slothlet.hook.on("math.add:before", () => {});
		await api.slothlet.reload();
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].pattern).toBe("math.add"); // exportHooks emits suffix → replay parses it
	});
});
