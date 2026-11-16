/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-stand-in-type-after-load.test.vitest.mjs
 *	@Date: 2026-11-15T08:40:52-08:00 (1794760852)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:51:10-08:00 (1794775870)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `__type` of a member read before its lazy folder loads, and kept, is the kind of what the member
 * reads as once the folder has loaded: "string" for a file's default-export string, "number" for a number, "object" for
 * an object or a Map, "function" for a function.
 *
 * @description
 * Before the folder loads the member's `__type` is the in-flight state. The expected kind is `typeof` of the file's
 * default export imported plainly (a function as "function", every other object as "object").
 * @module tests/vitests/suites/lazy/lazy-stand-in-type-after-load
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_lazy_held_standin");

const KEYS = ["map", "set", "date", "err", "arr", "obj", "fn", "str", "num"];

const configs = ["async", "live"].flatMap((runtime) =>
	[{ attribution: "precise" }, { attribution: "fast" }, { mode: "off" }, { mode: "disabled" }].map((permissions) => ({
		runtime,
		permissions,
		name: permissions.attribution ?? `permissions ${permissions.mode}`
	}))
);

/**
 * The kind of a file's default export, imported plainly.
 * @param {string} key - The file's name.
 * @returns {Promise<string>} Its kind.
 */
async function kindOf(key) {
	const value = (await import(`${pathToFileURL(join(FIXTURE, "d", `${key}.mjs`)).href}?plain-twin-type`)).default;
	return typeof value === "object" && value !== null ? "object" : typeof value;
}

describe.each(configs)("a kept member's __type once its lazy folder has loaded > lazy / $runtime / $name", ({ runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(KEYS)("is the kind of what the member reads as: %s", async (key) => {
		const expected = await kindOf(key);
		api = await slothlet({ base: FIXTURE, mode: "lazy", runtime, silent: true, permissions: { defaultPolicy: "allow", ...permissions } });
		const kept = api.d[key];
		expect(kept.__type).toBe(api.slothlet.types.IN_FLIGHT);
		await api.d;
		expect(kept.__type).toBe(expected);
	});
});
