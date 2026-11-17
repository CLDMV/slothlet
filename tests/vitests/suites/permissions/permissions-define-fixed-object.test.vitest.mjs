/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-define-fixed-object.test.vitest.mjs
 *	@Date: 2026-11-16T05:00:00-08:00 (1794834000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:48-08:00 (1794882588)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview While the permission system is on, a member defined read-only and non-configurable holding an object
 * or function in one step is refused (`API_MEMBER_FIXED_OBJECT`), on the api root and on any node, by the host and by
 * module code alike: the language would require the node to hand that very value out, so nothing beneath it could be
 * checked. Assigning the member and then locking it keeps it a node, checked beneath. A primitive value, and every
 * definition while the system is off or disabled, is defined as in plain JavaScript.
 *
 * @description
 * Fixture `api_test_define_fixed`: the base folder's `base` file (code of the module that owns the whole tree) defines
 * on `owner.data`; `owner` defines on its own node and assigns then locks; `reader` reads and writes beneath what
 * `owner` locked. The host defines on the api root and on `owner.data`. Each definition goes through
 * `Object.defineProperty`, `Object.defineProperties` and `Reflect.defineProperty`. Modes on, off and disabled; eager
 * and lazy; async and live; both attributions.
 * @module tests/vitests/suites/permissions/permissions-define-fixed-object
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_define_fixed");

const matrix = ["on", "off", "disabled"].flatMap((permissionMode) =>
	["eager", "lazy"].flatMap((mode) =>
		["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ permissionMode, mode, runtime, attribution })))
	)
);

const KINDS = ["object", "function", "primitive"];
const ROUTES = ["defineProperty", "defineProperties", "reflect"];
// Refused as the language refuses a definition an object cannot take: a `TypeError`, coded.
const REFUSED = { threw: "API_MEMBER_FIXED_OBJECT", typeError: true };

/**
 * A fresh value of a kind, as the fixture makes it.
 * @param {string} kind - `object`, `function` or `primitive`.
 * @returns {*} The value.
 */
const valueOf = (kind) => (kind === "object" ? { v: 1, hidden: "H" } : kind === "function" ? () => "fn" : "P");

/**
 * Define `key` on `node` read-only and non-configurable in one step, as the host.
 * @param {object} node - The node.
 * @param {string} key - The member.
 * @param {string} kind - The value's kind.
 * @param {string} how - The route.
 * @returns {*} What the route returned, or `{ threw, typeError }`.
 */
function fix(node, key, kind, how) {
	try {
		const descriptor = { value: valueOf(kind), writable: false, configurable: false, enumerable: true };
		if (how === "defineProperties") return Object.defineProperties(node, { [key]: descriptor }) === node;
		if (how === "reflect") return Reflect.defineProperty(node, key, descriptor);
		return Object.defineProperty(node, key, descriptor) === node;
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw", typeError: error instanceof TypeError };
	}
}

/**
 * What plain JavaScript gives for the same definition on a plain object, and what the object then holds.
 * @param {string} kind - The value's kind.
 * @param {string} how - The route.
 * @returns {{answer: *, held: *}} The route's answer and the member's value, read as the fixture reads it.
 */
function plain(kind, how) {
	const twin = {};
	const answer = fix(twin, "k", kind, how);
	return { answer, held: shown(twin.k) };
}

/**
 * A member's value, comparable across runs.
 * @param {*} value - The value.
 * @returns {*} Its JSON, a function's result, or the value.
 */
const shown = (value) =>
	typeof value === "function" ? value() : value !== null && typeof value === "object" ? JSON.stringify(value) : value;

describe.each(matrix)(
	"a member defined fixed holding an object > $permissionMode / $mode / $runtime / $attribution",
	({ permissionMode, mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const on = permissionMode === "on";

		const build = async () => {
			api = await slothlet({
				base: join(FIXTURE, "host"),
				mode,
				runtime,
				silent: true,
				permissions: {
					mode: permissionMode,
					policy: "allow",
					caller: {
						attribution
					},
					rules: [{ caller: "reader.**", target: "owner.data.locked.hidden", effect: "deny" }]
				}
			});
			for (const name of ["owner", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
			for (const name of ["base", "owner", "reader"]) await api[name];
			await api.owner.data;
			return api;
		};

		/**
		 * Check every kind and route, defined by `define` and read back by `read`.
		 * @param {function(string, string, string): *} define - Defines `key` with a value of `kind` by `how`.
		 * @param {function(string): *} read - The member's value as the host reads it.
		 * @param {function(string): boolean} has - Whether the member is there.
		 * @returns {Promise<void>}
		 */
		const checkAll = async (define, read, has) => {
			for (const kind of KINDS) {
				for (const how of ROUTES) {
					const key = `m_${kind}_${how}`;
					const twin = plain(kind, how);
					const answer = await define(key, kind, how);
					if (on && kind !== "primitive") {
						expect({ kind, how, answer }).toEqual({ kind, how, answer: REFUSED });
						expect({ kind, how, has: has(key) }).toEqual({ kind, how, has: false });
					} else {
						expect({ kind, how, answer }).toEqual({ kind, how, answer: twin.answer });
						expect({ kind, how, held: shown(read(key)) }).toEqual({ kind, how, held: twin.held });
					}
				}
			}
		};

		it("the host on the api root", async () => {
			await build();
			await checkAll(
				(key, kind, how) => fix(api, key, kind, how),
				(key) => api[key],
				(key) => key in api
			);
		});

		it("the host on a module's node", async () => {
			await build();
			await checkAll(
				(key, kind, how) => fix(api.owner.data, key, kind, how),
				(key) => api.owner.data[key],
				(key) => key in api.owner.data
			);
		});

		it("the code of the module owning the whole tree, on another module's node", async () => {
			await build();
			await checkAll(
				(key, kind, how) => api.base.onNode(key, kind, how),
				(key) => api.owner.data[key],
				(key) => key in api.owner.data
			);
		});

		it("a module on its own node", async () => {
			await build();
			await checkAll(
				(key, kind, how) => api.owner.define(key, kind, how),
				(key) => api.owner.data[key],
				(key) => key in api.owner.data
			);
		});

		it("keeps a member assigned and then locked checked beneath", async () => {
			await build();
			expect(await api.owner.assignThenLock("locked")).toBe(true);
			expect(Object.getOwnPropertyDescriptor(api.owner.data, "locked")).toMatchObject({ writable: false, configurable: false });
			expect(await api.reader.probe("locked")).toEqual(
				on
					? { hidden: { threw: "PERMISSION_DENIED" }, v: 1, write: { threw: "LOOSE_SET_NOT_OWNED" } }
					: { hidden: "H", v: 1, write: "wrote" }
			);
			expect(api.owner.data.locked.v).toBe(on ? 1 : 2);
		});
	}
);
