/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-namespace-own-keys.test.vitest.mjs
 *	@Date: 2026-11-15T09:17:23-08:00 (1794763043)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:00-08:00 (1795869120)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lazy folder that loads as a namespace lists the keys it lists in eager mode: its members, and no
 * `length` or `name` of a function (#794).
 *
 * @description
 * `d/` holds one file per kind of default export and no default function of its own, so it is a namespace. Once it has
 * loaded, `Reflect.ownKeys` and the descriptions of `length` and `name` are the eager node's, for the host and for a
 * module through `self`. A member that is a function (`d.fn`) keeps listing `length` and `name`, as in eager mode.
 * @module tests/vitests/suites/lazy/lazy-namespace-own-keys
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_lazy_held_standin");

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
 * What the host and the reader module list of `d`, or of one of its members.
 * @param {object} api - The api.
 * @param {string} [key] - The member's name; none for `d`.
 * @returns {Promise<object>} The listings.
 */
async function listings(api, key) {
	const node = key ? api.d[key] : api.d;
	const describe = (prop) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(node, prop);
		return descriptor && { value: descriptor.value, enumerable: descriptor.enumerable };
	};
	return {
		host: { keys: Reflect.ownKeys(node).map(String), length: describe("length"), name: describe("name") },
		module: await api.reader.own(key)
	};
}

describe.each(configs)("a lazy namespace folder's own keys once loaded > $runtime / $name", ({ runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each([undefined, "fn", "obj"])("are the eager node's: %s", async (key) => {
		const options = { base: FIXTURE, runtime, silent: true, permissions: { policy: "allow", ...permissions } };
		const eager = await slothlet({ ...options, mode: "eager" });
		const expected = await listings(eager, key);
		await eager.shutdown();
		api = await slothlet({ ...options, mode: "lazy" });
		await api.d;
		expect(await listings(api, key)).toEqual(expected);
	});
});
