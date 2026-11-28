/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-stand-in-type-after-load.test.vitest.mjs
 *	@Date: 2026-11-15T08:40:52-08:00 (1794760852)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:01-08:00 (1795869121)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `slothlet.node(member).type` of a member read before its lazy folder loads, and kept, is the kind of
 * what the member reads as once the folder has loaded: "function" for a function, "namespace" for an object with members,
 * "data" for anything else (a string, a number, an array, a Map).
 *
 * @description
 * Before the folder loads the member's type is the in-flight state. The expected kind is the kind of the file's default
 * export imported plainly.
 * @module tests/vitests/suites/lazy/lazy-stand-in-type-after-load
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_lazy_held_standin");

const KEYS = ["map", "set", "date", "err", "arr", "obj", "fn", "str", "num"];

const configs = ["async", "live"].flatMap((runtime) =>
	[{ caller: { attribution: "precise" } }, { caller: { attribution: "fast" } }, { mode: "off" }, { mode: "disabled" }].map(
		(permissions) => ({
			runtime,
			permissions,
			name: permissions.caller?.attribution ?? `permissions ${permissions.mode}`
		})
	)
);

/**
 * The kind of a file's default export, imported plainly.
 * @param {string} key - The file's name.
 * @returns {Promise<string>} Its kind.
 */
async function kindOf(key) {
	const value = (await import(`${pathToFileURL(join(FIXTURE, "d", `${key}.mjs`)).href}?plain-twin-type`)).default;
	if (typeof value === "function") return "function";
	const plainObject = value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
	return plainObject && Object.keys(value).length > 0 ? "namespace" : "data";
}

describe.each(configs)(
	"a kept member's node().type once its lazy folder has loaded > lazy / $runtime / $name",
	({ runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it.each(KEYS)("is the kind of what the member reads as: %s", async (key) => {
			const expected = await kindOf(key);
			api = await slothlet({ base: FIXTURE, mode: "lazy", runtime, silent: true, permissions: { policy: "allow", ...permissions } });
			const kept = api.d[key];
			expect(api.slothlet.node(kept).type).toBe(api.slothlet.types.IN_FLIGHT);
			await api.d;
			expect(api.slothlet.node(kept).type).toBe(expected);
		});
	}
);
