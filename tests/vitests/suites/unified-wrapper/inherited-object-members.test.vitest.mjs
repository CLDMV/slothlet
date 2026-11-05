/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/inherited-object-members.test.vitest.mjs
 *	@Date: 2026-11-04T21:16:47-08:00 (1793855807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:27:43-08:00 (1793860063)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Members an api node inherits from `Object.prototype` and `Function.prototype` answer as on the
 * plain value the module exported (#630).
 *
 * @description
 * `hasOwnProperty`, `__lookupGetter__`, `__defineSetter__` and the other inherited members are the value's own
 * surface, not api children. Wrapping one as a child listed it among the node's keys and gave it an api path, so a
 * `__`-prefixed one read as a module-private export and was denied with permissions on; on a node composed from
 * several exports it threw `recordedMember is not iterable`, because the composed key map answered the inherited
 * name too. Every case below makes the same call on the node and on a fresh copy of the exported value, from the
 * host and from module code through `self`, in eager and lazy mode, with permissions off and on. Exports really
 * named like those members stay api children, and a genuine `_`-prefixed export stays private.
 * @module tests/vitests/suites/unified-wrapper/inherited-object-members
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { exercise, shadowed } from "../../../../api_tests/api_test_inherited_members_lib/cases.mjs";

const BASE = resolve("api_tests/api_test_inherited_members");

let importCount = 0;
/**
 * Import a fixture file as a new module instance, so its exports are untouched by any slothlet instance.
 * @param {string} file - Path inside the fixture folder.
 * @returns {Promise<object>} The module namespace.
 */
const freshImport = (file) => import(`${pathToFileURL(join(BASE, file)).href}?plain=${++importCount}`);

const MODES = ["eager", "lazy"];

const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, allow, no rules", permissions: { defaultPolicy: "allow", rules: [] } },
	{
		name: "permissions on, allow, deny rule elsewhere",
		permissions: { defaultPolicy: "allow", rules: [{ caller: "**", target: "elsewhere.**", effect: "deny" }] }
	}
];

const NODES = [
	{
		name: "namespace composed from several exports",
		path: "obj",
		ownKey: "box",
		plain: async () => ({ ...(await freshImport("obj.mjs")) })
	},
	{ name: "object node", path: "obj.box", ownKey: "marker", plain: async () => (await freshImport("obj.mjs")).box },
	{ name: "callable node", path: "obj.named", ownKey: "child", plain: async () => (await freshImport("obj.mjs")).named },
	{
		name: "folder node with a callable default",
		path: "callable",
		ownKey: "extra",
		plain: async () => {
			const fn = (await freshImport("callable/callable.mjs")).default;
			fn.extra = { ...(await freshImport("callable/extra.mjs")) };
			return fn;
		}
	}
];

/**
 * Read the node at `path`, loading each node on the way in lazy mode.
 * @param {object} api - The api root.
 * @param {string} path - Dotted api path.
 * @returns {Promise<object|Function>} The node.
 */
async function nodeAt(api, path) {
	let node = api;
	for (const key of path.split(".")) {
		node = node[key];
		await node;
	}
	return node;
}

describe.each(MODES.flatMap((mode) => PERMISSIONS.map((entry) => ({ mode, ...entry }))))(
	"inherited members of api nodes > $mode, $name",
	({ mode, permissions }) => {
		let api;

		const load = async () => {
			api = await slothlet({ base: BASE, mode, ...(permissions ? { permissions } : {}) });
			await nodeAt(api, "probe");
			return api;
		};

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		describe.each(NODES)("$name", ({ path, ownKey, plain }) => {
			it("answers every inherited member as the exported value does, from the host", async () => {
				await load();
				const node = await nodeAt(api, path);
				expect(exercise(node, ownKey)).toEqual(exercise(await plain(), ownKey));
			});

			it("answers every inherited member as the exported value does, from module code through self", async () => {
				await load();
				await nodeAt(api, path);
				expect(await api.probe.run(path, ownKey)).toEqual(exercise(await plain(), ownKey));
			});

			it("does not list an inherited member among the node's keys after reading it", async () => {
				await load();
				const node = await nodeAt(api, path);
				const before = Object.keys(node);
				for (const member of ["hasOwnProperty", "isPrototypeOf", "__lookupGetter__", "__lookupSetter__", "valueOf", "toString"]) {
					void node[member];
				}
				expect(Object.keys(node)).toEqual(before);
				expect(before).not.toContain("hasOwnProperty");
			});
		});

		it("keeps exports named like Object.prototype members as api children, from the host and through self", async () => {
			await load();
			await nodeAt(api, "shadow");
			await nodeAt(api, "shadowdir.valueOf");
			await nodeAt(api, "shadowdir.toString");
			const expected = {
				toString: "own toString",
				valueOf: "own valueOf",
				hasOwnProperty: "own hasOwnProperty",
				dirValueOf: "file valueOf",
				dirToString: "file toString",
				shadowKeys: ["__hidden", "hasOwnProperty", "toString", "valueOf"],
				dirKeys: ["toString", "valueOf"]
			};
			expect(shadowed(api)).toEqual(expected);
			expect(await api.probe.runShadowed()).toEqual(expected);
		});

		it("keeps a genuine underscore-prefixed export private while inherited members stay callable", async () => {
			await load();
			const box = await nodeAt(api, "obj.box");
			expect(box.__lookupGetter__("marker")).toBeUndefined();
			await nodeAt(api, "shadow");
			if (permissions) {
				expect(() => api.shadow.__hidden()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
			} else {
				expect(api.shadow.__hidden()).toBe("hidden");
			}
		});
	}
);
