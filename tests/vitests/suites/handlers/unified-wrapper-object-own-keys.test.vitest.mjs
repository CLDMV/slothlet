/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-object-own-keys.test.vitest.mjs
 *	@Date: 2026-11-25T02:33:44-08:00 (1795602824)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T03:05:05-08:00 (1795604705)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object node keeps its value's non-enumerable own members non-enumerable (#964).
 *
 * @description
 * Adoption copied every own member of a module's object onto its node as an enumerable member, so `Object.keys()`,
 * `for…in`, `JSON.stringify()`, spread and the member's descriptor listed a member the object itself keeps out of
 * enumeration. 3f0a8e8d covered a function's members; this covers an object's.
 *
 * Every answer is compared with the same description of the fixture's module imported as a plain module, never a value
 * written down here: in eager and lazy mode, the async and live runtime, hooks on and off, and the permission system
 * off and on. The host reads the nodes, and so does another module through `self`.
 * @module tests/vitests/suites/handlers/unified-wrapper-object-own-keys
 */

import { describe as describeBlock, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { describe } from "../../../../api_tests/api_test_hidden_members/lib/describe.mjs";

const FIXTURE = resolve("api_tests/api_test_hidden_members");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		[true, false].flatMap((hooks) => [false, true].map((permissions) => ({ mode, runtime, hooks, permissions })))
	)
);

let twins = 0;

/**
 * A fresh copy of one of the fixture's api files, imported as a plain module.
 * @param {string} file - The file under the fixture's `api` folder.
 * @returns {Promise<object>} Its namespace.
 */
const twin = (file) => import(`${pathToFileURL(join(FIXTURE, "api", file)).href}?plain-twin-${++twins}`);

/**
 * What the plain modules give for every description the checks make.
 * @returns {Promise<object>} The descriptions, by name.
 */
async function plain() {
	const conf = (await twin("conf.mjs")).default;
	const { opts } = await twin("named.mjs");
	return {
		conf: describe(conf, ["visible", "inner", "hidden", "secret", "computed"]),
		inner: describe(conf.inner, ["deep", "tucked"]),
		secret: describe(conf.secret, ["deep"]),
		opts: describe(opts, ["a", "quiet"])
	};
}

/**
 * A plain object like the fixture's, for `api.add`.
 * @returns {object} The object.
 */
function syntheticData() {
	const data = { a: 1, nested: { b: 2 } };
	Object.defineProperty(data, "quiet", { value: 3, enumerable: false, writable: true, configurable: true });
	Object.defineProperty(data.nested, "tucked", { value: 4, enumerable: false, writable: true, configurable: true });
	return data;
}

describeBlock.each(matrix)(
	"object node own keys > $mode / $runtime / hooks $hooks / permissions $permissions",
	({ mode, runtime, hooks, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.().catch(() => {});
			api = null;
		});

		/**
		 * Build an instance over the fixture's api folder with the reader mounted, every node the checks touch loaded.
		 * @returns {Promise<object>} The api.
		 */
		async function build() {
			api = await slothlet({
				base: join(FIXTURE, "api"),
				mode,
				runtime,
				silent: true,
				hook: { enabled: hooks },
				...(permissions ? { permissions: { policy: "allow" } } : {})
			});
			await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
			for (const node of [api.conf, api.conf.inner, api.conf.secret, api.named, api.named.opts, api.reader]) await node;
			return api;
		}

		it("lists, serializes and describes an exported object's members as the plain object does, for the host", async () => {
			const expected = await plain();
			await build();
			expect(describe(api.conf, ["visible", "inner", "hidden", "secret", "computed"])).toEqual(expected.conf);
			expect(describe(api.conf.inner, ["deep", "tucked"])).toEqual(expected.inner);
			expect(describe(api.conf.secret, ["deep"])).toEqual(expected.secret);
			expect(describe(api.named.opts, ["a", "quiet"])).toEqual(expected.opts);
		});

		it("lists, serializes and describes them as the plain object does, for another module", async () => {
			const expected = await plain();
			await build();
			expect(await api.reader.look()).toEqual(expected);
		});

		it("keeps a non-enumerable member of an object added at runtime out of enumeration", async () => {
			const reference = syntheticData();
			await build();
			await api.slothlet.api.add("syn", { data: syntheticData() });
			await api.syn;
			await api.syn.data;
			expect(describe(api.syn.data, ["a", "nested", "quiet"])).toEqual(describe(reference, ["a", "nested", "quiet"]));
			expect(describe(api.syn.data.nested, ["b", "tucked"])).toEqual(describe(reference.nested, ["b", "tucked"]));
			expect(JSON.stringify(api.syn)).toBe(JSON.stringify({ data: reference }));
		});
	}
);
