/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/private-function-member-engine-names.test.vitest.mjs
 *	@Date: 2026-11-25T21:00:00-08:00 (1795669200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:46-08:00 (1795869166)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Underscore names the engine gives every object and function are not module-private members.
 *
 * @description
 * A `_`/`__`-named function member of a node is module-private, and another module's (or the host's) read of it is
 * refused. `__proto__`, `__lookupGetter__`, `__lookupSetter__`, `__defineGetter__` and `__defineSetter__` are the
 * engine's own, inherited from `Object.prototype` and `Function.prototype`; they read as they do on the plain value
 * while a module export of an underscore name stays refused.
 *
 * Fixture: `api_tests/api_test_inherited_members` (`obj.box` is an object, `obj.named` a function, `shadow.__hidden` a
 * module-private function export).
 */

import { resolve } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_inherited_members");

const ENGINE_NAMES = ["__lookupGetter__", "__lookupSetter__", "__defineGetter__", "__defineSetter__"];

describe.each(["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime }))))(
	"Permissions > engine underscore names on api nodes > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const load = async () => {
			api = await slothlet({ base: BASE, mode, runtime, permissions: { policy: "allow", rules: [] } });
			await api.obj;
			await api.obj.box;
			await api.obj.named;
			await api.shadow;
			return api;
		};

		it("answers __proto__ of an object node and a function node as the engine's prototypes", async () => {
			await load();
			expect(api.obj.box.__proto__ === Object.prototype).toBe(true);
			expect(api.obj.named.__proto__ === Function.prototype).toBe(true);
		});

		it("answers the engine's other underscore methods as the plain value does", async () => {
			await load();
			for (const name of ENGINE_NAMES) {
				expect(api.obj.box[name], `box.${name}`).toBe(Object.prototype[name]);
				expect(api.obj.named[name], `named.${name}`).toBe(Object.prototype[name]);
			}
			expect(api.obj.box.__lookupGetter__("marker")).toBeUndefined();
		});

		it("keeps a module's own underscore-named function export refused to the host", async () => {
			await load();
			let read;
			try {
				read = typeof api.shadow.__hidden;
			} catch (error) {
				read = `threw ${error.code}`;
			}
			expect(read).toBe("threw PERMISSION_DENIED");
		});
	}
);
