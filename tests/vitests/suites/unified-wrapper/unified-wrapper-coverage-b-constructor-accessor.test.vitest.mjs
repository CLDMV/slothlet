/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-constructor-accessor.test.vitest.mjs
 *	@Date: 2026-11-25T01:46:37-08:00 (1795599997)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:13-08:00 (1795869193)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `constructor` an object's prototype answers through a getter reads as the getter answers it.
 *
 * @description
 * Fixture `api_test_uwb_constructor_accessor` (`ctor.mjs`): objects made with `Object.create()` over a prototype whose
 * `constructor` getter returns a primitive, a plain object, a function no node fronts, or the module's own exported
 * function. Plain JS: `prim.constructor === 5`, `obj.constructor.kind === "obj"`, `fnv.constructor()` runs the helper,
 * and `nodeFn.constructor` is the exported function, which the api hands out as its node.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-constructor-accessor
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_constructor_accessor", import.meta.url).pathname;

const MATRIX = ["eager", "lazy"].flatMap((mode) => [
	{ mode, name: "permissions on", permissions: { policy: "allow" } },
	{ mode, name: "permissions off", permissions: null }
]);

describe.each(MATRIX)("constructor getter on a prototype > $mode / $name", ({ mode, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("reads what the getter answers", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		if (mode === "lazy") await api.ctor;
		const ctor = api.ctor;
		expect(ctor.prim.constructor).toBe(5);
		expect(ctor.obj.constructor.kind).toBe("obj");
		expect(typeof ctor.fnv.constructor).toBe("function");
		expect(ctor.fnv.constructor()).toBe("helper");
		expect(ctor.nodeFn.constructor).toBe(ctor.exported);
		expect(ctor.nodeFn.constructor()).toBe("exported");
	});
});
