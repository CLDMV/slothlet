/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-function-value-of.test.vitest.mjs
 *	@Date: 2026-11-25T01:46:51-08:00 (1795600011)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:16:49-08:00 (1795601809)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function node whose function carries its own `valueOf` and `toString` answers them as the function
 * does.
 *
 * @description
 * Fixture `api_test_uwb_fn_members`:
 * ```
 * valued.mjs     default function with valueOf() -> 42 and toString() -> "valued!"
 * numbered.mjs   default function with valueOf = 7 and toString = "text" (data, not methods)
 * ```
 * Plain JS: `valued.valueOf() === 42`, `String(valued) === "valued!"`, `+valued === 42`, `numbered.valueOf === 7`.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-function-value-of
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_fn_members", import.meta.url).pathname;

const MATRIX = ["eager", "lazy"].flatMap((mode) => [
	{ mode, name: "permissions on", permissions: { policy: "allow" } },
	{ mode, name: "permissions off", permissions: null }
]);

describe.each(MATRIX)("function node's own valueOf and toString > $mode / $name", ({ mode, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("answers the function's own methods and data as plain JS does", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		if (mode === "lazy") {
			await api.valued;
			await api.numbered;
		}
		expect(api.valued.valueOf()).toBe(42);
		expect(+api.valued).toBe(42);
		expect(String(api.valued)).toBe("valued!");
		expect(api.valued.toString()).toBe("valued!");
		expect(api.numbered.valueOf).toBe(7);
		expect(api.numbered.toString).toBe("text");
		expect(api.valued()).toBe("valued");
	});

	it("describes the function's own prototype, length and name as the function holds them", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		if (mode === "lazy") await api.valued;
		const prototype = Object.getOwnPropertyDescriptor(api.valued, "prototype");
		expect(prototype).toMatchObject({ writable: true, enumerable: false });
		expect(prototype.value).toBe(api.valued.prototype);
		expect(api.slothlet.same(prototype.value.constructor, api.valued)).toBe(true);
		expect(Object.getOwnPropertyDescriptor(api.valued, "length")).toEqual({
			value: 0,
			writable: false,
			enumerable: false,
			configurable: true
		});
		expect(Object.getOwnPropertyDescriptor(api.valued, "name")).toEqual({
			value: "valued",
			writable: false,
			enumerable: false,
			configurable: true
		});
	});
});
