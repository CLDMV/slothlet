/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-closed-set.test.vitest.mjs
 *	@Date: 2026-11-25T02:24:45-08:00 (1795602285)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T03:24:09-08:00 (1795605849)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Once the host closes the api root (`Object.preventExtensions`, `Object.seal`, `Object.freeze`), a write
 * a module makes on its `self` answers as the same write on a plain object closed the same way, and as on the host's
 * `api` (#960): `Reflect.set` of a new member answers false, a strict assignment of one throws a TypeError, a sloppy one
 * does nothing, and a member the root already holds takes the write unless the root is frozen. The api a hook the
 * module registered is handed answers the same.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { writes } from "../../../../api_tests/api_test_closed_self_set/lib/writes.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_closed_self_set");

const CONFIGS = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));
const CLOSES = ["preventExtensions", "seal", "freeze"];

/**
 * What the writes give on a plain object closed with `how`.
 * @param {string} how - The `Object` method that closes it.
 * @returns {Record<string, *>} What each write gave.
 */
function plain(how) {
	const twin = { counter: 0 };
	Object[how](twin);
	return writes(twin, "counter");
}

describe.each(CONFIGS)("writes on a closed self answer as plain JS > $mode / $runtime", ({ mode, runtime }) => {
	it.each(CLOSES)("%s: through self and a hook's api, as on a plain object and on api", async (how) => {
		const api = await slothlet({ base: path.join(FIXTURE, "api"), mode, runtime, silent: true, hook: { enabled: true } });
		try {
			expect(await api.probe.seed()).toBe(0);
			Object[how](api);
			const expected = plain(how);
			expect(await api.probe.closedWrites()).toEqual(expected);
			expect(writes(api, "counter")).toEqual(expected);
			// The api a hook the module registered is handed (the root as the module reads it) answers the same.
			await api.probe.target();
			expect(await api.probe.hookWrites()).toEqual(expected);
		} finally {
			await api.shutdown();
		}
	});
});

describe("the plain-object reference", () => {
	it.each(CLOSES)("%s: a new member is refused, strict throws, sloppy is silent", (how) => {
		const result = plain(how);
		expect(result.reflectFresh).toEqual({ value: false });
		expect(result.strictFresh).toEqual({ threw: "TypeError" });
		expect(result.sloppyFresh).toEqual({ value: true });
		expect(result.hasSloppyFresh).toBe(false);
		expect(result.afterSloppyExisting).toBe(how === "freeze" ? 0 : 4);
	});
});
