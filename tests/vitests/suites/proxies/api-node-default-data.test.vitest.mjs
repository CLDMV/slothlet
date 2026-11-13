/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-default-data.test.vitest.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node of a file's default export that is built-in data (a map, a set, a date, an error) answers
 * another module as the same data reached as a named export does.
 *
 * @description
 * The fixture's `single` folder holds one file per value, each the file's default export, and its `owner` file exports
 * the same values by name. A reader with no write rights of its own and a writer the rules grant write rights read and
 * change both through `self`, in eager and lazy mode, the async and live runtime, and under both attributions. The
 * expected answers are plain JavaScript's where the reader may make the access, and the rules' where it may not.
 * @module tests/vitests/suites/proxies/api-node-default-data
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_default_data");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const guarded = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));
const open = MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime })));

/** Each collection's kind, by key. */
const KINDS = { dmap: "map", dset: "set", dlist: "list", dconfig: "object", ditem: "object" };

/** Each way the fixture reaches the object a collection holds, by kind. */
const ROUTES = {
	map: ["get", "values", "entries", "iterate", "forOf", "forEach"],
	set: ["values", "entries", "iterate", "forEach"],
	list: ["index", "at", "iterate", "forEach", "find"],
	object: ["member", "values"]
};

/** Every collection and route, as test rows. */
const WRITES = Object.entries(KINDS).flatMap(([key, kind]) => ROUTES[kind].map((route) => ({ key, kind, route })));

/** Each change a collection's or a date's own method makes, by the key it is made to. */
const CHANGES = [
	{ key: "dmap", how: "mapSet" },
	{ key: "dmap", how: "mapDelete" },
	{ key: "dmap", how: "mapClear" },
	{ key: "dset", how: "setAdd" },
	{ key: "dset", how: "setDelete" },
	{ key: "dset", how: "setClear" },
	{ key: "ddate", how: "dateSet" }
];

/** The rules giving the writer write rights on both modules. */
const WRITER_RULES = [
	{ caller: "writer.**", target: "owner.**:write", effect: "allow" },
	{ caller: "writer.**", target: "single.**:write", effect: "allow" }
];

/**
 * Build an instance with the owner, the files of single values, the reader and the writer mounted as modules of their
 * own, every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	for (const name of ["owner", "single", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
	for (const name of ["owner", "single", "reader", "writer"]) await api[name];
	for (const key of [...Object.keys(KINDS), "ddate", "derr"]) {
		await api.owner[key];
		await api.single[key];
	}
	return api;
}

/**
 * What a module's collections hold, read by the host: the `n` of the object each holds, and the map's and set's sizes
 * and the date's time value.
 * @param {object} api - The api.
 * @param {string} module - `owner` or `single`.
 * @returns {object} What they hold.
 */
function held(api, module) {
	const node = api[module];
	return {
		map: node.dmap.get("one")?.n,
		set: node.dset.values().next().value?.n,
		list: node.dlist[0].n,
		object: node.dconfig.one.n,
		item: node.ditem.one.n,
		sizes: { map: node.dmap.size, set: node.dset.size, date: node.ddate.getTime() }
	};
}

describe.each(guarded)(
	"data a file's default export holds, permission system on > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const build = (rules = []) =>
			mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules: [...WRITER_RULES, ...rules] } });

		it.each(WRITES)("a reader with no write rights changes nothing the owner holds: $key, $route", async ({ key, kind, route }) => {
			api = await build();
			const before = { owner: held(api, "owner"), single: held(api, "single") };
			expect(await api.reader.write("owner", key, kind, route, 5)).toEqual({ threw: "LOOSE_SET_NOT_OWNED" });
			expect(await api.reader.write("single", key, kind, route, 5)).toEqual({ threw: "LOOSE_SET_NOT_OWNED" });
			expect({ owner: held(api, "owner"), single: held(api, "single") }).toEqual(before);
		});

		it.each(CHANGES)("a reader with no write rights changes nothing with the object's own methods: $key, $how", async ({ key, how }) => {
			api = await build();
			const before = { owner: held(api, "owner"), single: held(api, "single") };
			expect(await api.reader.change("owner", key, how)).toEqual({ threw: "LOOSE_SET_NOT_OWNED" });
			expect(await api.reader.change("single", key, how)).toEqual({ threw: "LOOSE_SET_NOT_OWNED" });
			expect({ owner: held(api, "owner"), single: held(api, "single") }).toEqual(before);
		});

		it("a write rule denying the reader refuses the write by either route", async () => {
			api = await build([
				{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
				{ caller: "reader.**", target: "single.**:write", effect: "allow" },
				{ caller: "reader.**", target: "owner.dmap.**:write", effect: "deny" },
				{ caller: "reader.**", target: "single.dmap.**:write", effect: "deny" }
			]);
			const before = { owner: held(api, "owner"), single: held(api, "single") };
			expect(await api.reader.write("owner", "dmap", "map", "get", 5)).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.write("single", "dmap", "map", "get", 5)).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.change("owner", "dmap", "mapSet")).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.change("single", "dmap", "mapSet")).toEqual({ threw: "PERMISSION_DENIED" });
			expect({ owner: held(api, "owner"), single: held(api, "single") }).toEqual(before);
		});

		it.each(WRITES)("a module with write rights writes through by either route: $key, $route", async ({ key, kind, route }) => {
			for (const module of ["owner", "single"]) {
				api = await build();
				expect(await api.writer.write(module, key, kind, route, 5)).toEqual({ ok: 5 });
				expect(held(api, module)[{ dmap: "map", dset: "set", dlist: "list", dconfig: "object", ditem: "item" }[key]]).toBe(5);
				await api.shutdown();
				api = null;
			}
		});

		it.each(CHANGES)("a module with write rights changes the object with its own methods: $key, $how", async ({ key, how }) => {
			const answers = [];
			for (const module of ["owner", "single"]) {
				api = await build();
				const result = await api.writer.change(module, key, how);
				answers.push({ result, sizes: held(api, module).sizes });
				await api.shutdown();
				api = null;
			}
			expect(answers[0].result).not.toHaveProperty("threw");
			expect(answers[1]).toEqual(answers[0]);
		});

		it("the host writes through by either route", async () => {
			api = await build();
			api.owner.dmap.get("one").n = 5;
			api.single.dmap.get("one").n = 5;
			api.single.ddate.setTime(99);
			expect(await api.owner.held()).toEqual([5, 1, 1, 1, 1]);
			expect(held(api, "single").map).toBe(5);
			expect(held(api, "single").sizes.date).toBe(99);
		});
	}
);

describe.each(open)("data a file's default export holds, permission system off > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	// Plain JavaScript: every module writes what it holds a reference to.
	it.each(WRITES)("a module writes through by either route, as in plain JavaScript: $key, $route", async ({ key, kind, route }) => {
		for (const module of ["owner", "single"]) {
			api = await mount({ mode, runtime });
			expect(await api.reader.write(module, key, kind, route, 5)).toEqual({ ok: 5 });
			expect(held(api, module)[{ dmap: "map", dset: "set", dlist: "list", dconfig: "object", ditem: "item" }[key]]).toBe(5);
			await api.shutdown();
			api = null;
		}
	});
});
