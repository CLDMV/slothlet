/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/node-set-prototype.test.vitest.mjs
 *	@Date: 2026-11-15T11:55:23-08:00 (1794772523)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:49:13-08:00 (1794779353)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `Object.setPrototypeOf` on an api node either changes what the node reports and inherits from, or is
 * refused, never a `true` that changes nothing (#802).
 *
 * @description
 * A node a module's own value backs as it is (an emitter, a class instance) takes the prototype on that value, as
 * setting it on the value itself does: the node reports it, members inherit from it, and the module sees its value
 * changed. A function node never writes to the module's function (a member written through it stays the node's), so it
 * keeps its function's prototype and refuses another one, as the api root does for a function root: `Reflect` answers
 * false and `Object.setPrototypeOf` throws a TypeError. A namespace slothlet composed reports no prototype and keeps it,
 * as a module namespace object does. Setting the prototype a node already reports answers true.
 *
 * Module code meets the node's write rules first, whatever the answer would be: a module that does not own the node is
 * refused with `LOOSE_SET_NOT_OWNED` when the permission system is on.
 * @module tests/vitests/suites/proxies/node-set-prototype
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_set_prototype");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
];
const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

/**
 * Run a change, answering how it went.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
function attempt(change) {
	try {
		return change() === false ? "refused" : "done";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

describe.each(matrix)("setPrototypeOf on an api node > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/**
	 * Build the instance, with the reader module added, and load every node the tests use.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ base: join(FIXTURE, "host"), silent: true, mode, runtime, ...(permissions ? { permissions } : {}) });
		await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
		for (const node of [api.leaf, api.leaf.only, api.grp, api.ev, api.ev.em, api.ev.inst, api.reader]) await node;
		return api;
	};

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each([
		["a function leaf", () => api.leaf.only],
		["a folder that is its file's function", () => api.grp]
	])("%s keeps its function's prototype and refuses another", async (_label, node) => {
		await build();
		const prototype = { inherited: 5 };
		expect(Reflect.setPrototypeOf(node(), prototype)).toBe(false);
		expect(attempt(() => Object.setPrototypeOf(node(), prototype))).toBe("TypeError");
		expect(Object.getPrototypeOf(node())).toBe(Function.prototype);
		expect(node().inherited).toBeUndefined();
		expect("inherited" in node()).toBe(false);
		expect(Reflect.setPrototypeOf(node(), Function.prototype)).toBe(true);
		expect(await api.leaf.untouched()).toBe(true);
	});

	it("a composed namespace keeps reporting no prototype, and refuses another", async () => {
		await build();
		expect(Object.getPrototypeOf(api.ev)).toBe(null);
		expect(Reflect.setPrototypeOf(api.ev, { inherited: 5 })).toBe(false);
		expect(api.ev.inherited).toBeUndefined();
		expect(Reflect.setPrototypeOf(api.ev, null)).toBe(true);
		expect(Object.getPrototypeOf(api.ev)).toBe(null);
	});

	it("an emitter a module holds takes the prototype on the module's emitter, and inherits from it", async () => {
		await build();
		const prototype = Object.create(EventEmitter.prototype, { inherited: { value: 5 } });
		expect(Reflect.setPrototypeOf(api.ev.em, prototype)).toBe(true);
		expect(Object.getPrototypeOf(api.ev.em)).toBe(prototype);
		expect(api.ev.em.inherited).toBe(5);
		expect(api.ev.em instanceof EventEmitter).toBe(true);
		expect((await api.ev.prototypes()).em).toBe(prototype);
	});

	it("a class instance a module holds takes the prototype on the module's instance, and inherits from it", async () => {
		await build();
		const prototype = { inherited: 5 };
		expect(Reflect.setPrototypeOf(api.ev.inst, prototype)).toBe(true);
		expect(Object.getPrototypeOf(api.ev.inst)).toBe(prototype);
		expect(api.ev.inst.inherited).toBe(5);
		expect((await api.ev.prototypes()).inst).toBe(prototype);
	});

	it("the owning module's code changes its own values' prototypes, and is refused one on a function node", async () => {
		await build();
		const prototype = { inherited: 5 };
		expect(await api.ev.change("em", prototype)).toBe("done");
		expect(await api.ev.change("inst", prototype)).toBe("done");
		expect(await api.ev.change("leaf", prototype)).toBe("refused");
		expect(await api.ev.change("grp", prototype)).toBe("refused");
		const held = await api.ev.prototypes();
		expect(held.em).toBe(prototype);
		expect(held.inst).toBe(prototype);
		expect(await api.leaf.untouched()).toBe(true);
	});

	it("another module's code meets the node's write rules first", async () => {
		await build();
		const before = await api.ev.prototypes();
		const answers = {};
		for (const which of ["em", "inst", "leaf", "grp"]) answers[which] = await api.reader.change(which);
		if (permissions) {
			expect(answers).toEqual({
				em: "LOOSE_SET_NOT_OWNED",
				inst: "LOOSE_SET_NOT_OWNED",
				leaf: "LOOSE_SET_NOT_OWNED",
				grp: "LOOSE_SET_NOT_OWNED"
			});
			expect(await api.ev.prototypes()).toEqual(before);
		} else {
			expect(answers).toEqual({ em: "done", inst: "done", leaf: "refused", grp: "refused" });
			const after = await api.ev.prototypes();
			expect(after.em).toEqual({ theirs: true });
			expect(after.inst).toEqual({ theirs: true });
		}
		expect(await api.leaf.untouched()).toBe(true);
	});
});
