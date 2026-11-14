/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-default-collection.test.vitest.mjs
 *	@Date: 2026-11-13T17:51:56-08:00 (1794621116)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T23:21:06-08:00 (1794640866)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node of a file whose default export is a `Map` or a `Set` fronts the value as data: it iterates,
 * answers `instanceof` and runs the value's own methods as the value does, and those methods are no api paths of their
 * own.
 *
 * @description
 * The fixture's `single/dmap.mjs` exports `new Map([["one", { n: 1 }]])` by default and `single/dset.mjs`
 * `new Set([{ n: 1 }])`. The host and a module reading through `self` ask each node the same questions, in eager and
 * lazy mode, the async and live runtime, with the permission system on (both attributions), off and disabled. The
 * expected answers are plain JavaScript's on the same value imported outside slothlet.
 * @module tests/vitests/suites/proxies/api-node-default-collection
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_default_data");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions on, precise", permissions: { mode: "on", defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { mode: "on", defaultPolicy: "allow", attribution: "fast" } },
	{ name: "permissions off", permissions: { mode: "off" } },
	{ name: "permissions disabled", permissions: { mode: "disabled" } }
];

const configs = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));
const guarded = configs.filter(({ permissions }) => permissions.mode === "on");

/** The collections asked, by key. */
const COLLECTIONS = ["dmap", "dset"];

/**
 * Build an instance with the files of single values, the reader and the writer mounted as modules of their own, every
 * node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, hook: true, ...options });
	for (const name of ["single", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
	for (const name of ["single", "reader", "writer"]) await api[name];
	for (const key of COLLECTIONS) await api.single[key];
	return api;
}

/**
 * The value a fixture file exports by default, imported as a module imports it, outside slothlet.
 * @param {string} key - The file's name.
 * @returns {Promise<Map|Set>} The value.
 */
async function twin(key) {
	return (await import(`${pathToFileURL(join(FIXTURE, "single", `${key}.mjs`)).href}?plain-twin-collection`)).default;
}

/**
 * What a collection answers, the same questions as the fixture's `collection` asks.
 * @param {Map|Set} node - The collection or its node.
 * @returns {object} The answers.
 */
function collection(node) {
	const answer = (check) => {
		try {
			return check();
		} catch (error) {
			return { threw: error?.code ?? error?.name ?? "threw" };
		}
	};
	return {
		spread: answer(() => JSON.stringify([...node])),
		forOf: answer(() => {
			const seen = [];
			for (const entry of node) seen.push(entry);
			return JSON.stringify(seen);
		}),
		entries: answer(() => JSON.stringify([...node.entries()])),
		keys: answer(() => JSON.stringify([...node.keys()])),
		values: answer(() => JSON.stringify([...node.values()])),
		forEach: answer(() => {
			const seen = [];
			node.forEach((value, key) => seen.push([key, value]));
			return JSON.stringify(seen);
		}),
		size: answer(() => node.size),
		get: answer(() => (typeof node.get === "function" ? JSON.stringify(node.get("one")) : null)),
		has: answer(() => node.has("one")),
		isMap: answer(() => node instanceof Map),
		isSet: answer(() => node instanceof Set),
		ownKeys: answer(() => Object.keys(node))
	};
}

describe.each(configs)("a node of a file's default Map or Set > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(COLLECTIONS)("answers the host and a module reading it through self as the value does: %s", async (key) => {
		const expected = collection(await twin(key));
		api = await mount({ mode, runtime, permissions });
		expect(collection(api.single[key])).toEqual(expected);
		expect(await api.reader.collection("single", key)).toEqual(expected);
		expect(await api.writer.collection("single", key)).toEqual(expected);
		// Calling its methods gives the node no members of its own, as calling them gives the value none.
		expect(Object.keys(api.single[key])).toEqual([]);
	});

	it("runs a change the host makes on the value, as on the value itself", async () => {
		const map = await twin("dmap");
		const set = await twin("dset");
		const plain = { map: new Map(map), set: new Set(set) };
		api = await mount({ mode, runtime, permissions });
		const node = { map: api.single.dmap, set: api.single.dset };
		for (const target of [plain, node]) {
			target.map.set("two", { n: 2 });
			target.set.add("two");
		}
		expect(collection(node.map)).toEqual(collection(plain.map));
		expect(collection(node.set)).toEqual(collection(plain.set));
		for (const target of [plain, node]) {
			target.map.delete("one");
			target.set.clear();
		}
		expect(collection(node.map)).toEqual(collection(plain.map));
		expect(collection(node.set)).toEqual(collection(plain.set));
	});

	it("its methods are no api paths: a hook on one never runs", async () => {
		api = await mount({ mode, runtime, permissions });
		let ran = 0;
		api.slothlet.hook.on("single.dmap.get:before", () => void ran++);
		api.slothlet.hook.on("single.dset.has:before", () => void ran++);
		api.single.dmap.get("one");
		api.single.dset.has("one");
		await api.reader.collection("single", "dmap");
		await api.reader.collection("single", "dset");
		expect(ran).toBe(0);
	});
});

describe.each(guarded)("rules on a node of a file's default Map or Set > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const build = (rules) => mount({ mode, runtime, permissions: { ...permissions, rules } });

	it.each(COLLECTIONS)("a rule on one of its methods' names is no rule on the value: %s", async (key) => {
		const expected = collection(await twin(key));
		const method = key === "dmap" ? "get" : "has";
		api = await build([{ caller: "reader.**", target: `single.${key}.${method}`, effect: "deny" }]);
		expect(await api.reader.collection("single", key)).toEqual(expected);
		expect(collection(api.single[key])).toEqual(expected);
	});

	it.each(COLLECTIONS)("a rule on its path, and on everything beneath it, refuses the module it names every member: %s", async (key) => {
		const expected = collection(await twin(key));
		for (const target of [`single.${key}`, `single.${key}.**`]) {
			api = await build([{ caller: "reader.**", target, effect: "deny" }]);
			const answers = await api.reader.collection("single", key);
			for (const question of ["spread", "forOf", "entries", "keys", "values", "forEach", "size", "has"])
				expect(answers[question]).toEqual({ threw: "PERMISSION_DENIED" });
			// The host and a module the rule does not name read on, as in plain JavaScript.
			expect(collection(api.single[key])).toEqual(expected);
			expect(await api.writer.collection("single", key)).toEqual(expected);
			await api.shutdown();
			api = null;
		}
	});
});
