/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-root-host-assign.test.vitest.mjs
 *	@Date: 2026-11-16T00:59:40-08:00 (1794819580)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:07-08:00 (1794882607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object or function the host assigns directly on the api root is held to the rules beneath it, as
 * one the host assigns on a module's node is: read, listed and serialized at the root's path and the member's name,
 * written only by who owns it, called only by who may call it.
 *
 * @description
 * Fixture `api_test_root_host_assign`: the base folder is an object root (`host-object`) or a function root
 * (`host-function`); `reader` and `nested` are added as modules. The host assigns `api.ownNothing = { a: 1 }`,
 * `api.nested.ownNothing = { a: 1 }` and `api.ownFn = () => "fn"`. Under `defaultPolicy: "deny"` with the reader
 * allowed only its own subtree, the reader is refused what is beneath; with a rule allowing it the member, it gets
 * what plain JavaScript gives for the same object. Eager and lazy, async and live, both attributions.
 * @module tests/vitests/suites/permissions/permissions-root-host-assign
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_root_host_assign");

const matrix = ["host-object", "host-function"].flatMap((root) =>
	["eager", "lazy"].flatMap((mode) =>
		["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ root, mode, runtime, attribution })))
	)
);

const DENIED = { threw: "PERMISSION_DENIED" };
const NOT_OWNED = { threw: "LOOSE_SET_NOT_OWNED" };

/**
 * What plain JavaScript gives each route for `{ a: 1 }` (the write excepted: the reader owns none of it).
 * @returns {Record<string, *>} The answers.
 */
function plain() {
	const twin = { a: 1 };
	const forIn = [];
	for (const key in twin) forIn.push(key);
	return { read: twin.a, keys: Object.keys(twin), forIn, json: JSON.stringify(twin), write: NOT_OWNED };
}

describe.each(matrix)(
	"an object the host assigns on the api root > $root / $mode / $runtime / $attribution",
	({ root, mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const build = async (rules) => {
			api = await slothlet({
				base: join(FIXTURE, root),
				mode,
				runtime,
				silent: true,
				permissions: {
					policy: "deny",
					caller: {
						attribution
					},
					rules: [{ caller: "reader.**", target: "reader.**", effect: "allow" }, ...rules]
				}
			});
			for (const name of ["reader", "nested"]) await api.slothlet.api.add(name, join(FIXTURE, name), { id: name });
			for (const name of ["reader", "nested"]) await api[name];
			api.ownNothing = { a: 1 };
			api.nested.ownNothing = { a: 1 };
			api.ownFn = () => "fn";
			return api;
		};

		it("refuses a reader no rule allows what is beneath it, as for one the host assigns on a module's node", async () => {
			await build([]);
			const refused = { read: DENIED, keys: [], forIn: [], json: "{}", write: NOT_OWNED };
			expect(await api.reader.routes("ownNothing")).toEqual(refused);
			expect(await api.reader.routes("nested.ownNothing")).toEqual(refused);
			expect(await api.reader.callFn()).toEqual(DENIED);
			// Nothing changed, and the host still sees and calls everything.
			expect(api.ownNothing.a).toBe(1);
			expect(JSON.stringify(api.ownNothing)).toBe(JSON.stringify({ a: 1 }));
			expect(api.ownFn()).toBe("fn");
		});

		it("gives a reader the rules allow what plain JavaScript gives, and still refuses its write", async () => {
			await build([
				{ caller: "reader.**", target: "ownNothing.**", effect: "allow" },
				{ caller: "reader.**", target: "ownNothing", effect: "allow" },
				{ caller: "reader.**", target: "nested.ownNothing.**", effect: "allow" },
				{ caller: "reader.**", target: "nested.ownNothing", effect: "allow" },
				{ caller: "reader.**", target: "ownFn", effect: "allow" }
			]);
			expect(await api.reader.routes("ownNothing")).toEqual(plain());
			expect(await api.reader.routes("nested.ownNothing")).toEqual(plain());
			expect(await api.reader.callFn()).toBe("fn");
			expect(api.ownNothing.a).toBe(1);
		});
	}
);
