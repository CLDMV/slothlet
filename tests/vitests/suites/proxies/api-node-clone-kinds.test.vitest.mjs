/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-clone-kinds.test.vitest.mjs
 *	@Date: 2026-11-13T00:32:54-08:00 (1794558774)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:23:52-08:00 (1794583432)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The platform's cloning functions copy a built-in data object read through the api as they copy the
 * module's own object (#751).
 *
 * @description
 * A date, map, set, error, pattern, buffer, typed array, `DataView` or boxed primitive a module exports reaches another
 * module through `self` as a view while the permission system is on, and as a node when it is a file's default export.
 * `structuredClone`, `v8.serialize` and `postMessage` copy it from reads the reader may make, in every configuration.
 * The expected value is always what the same function gives on the module imported as a plain module.
 * @module tests/vitests/suites/proxies/api-node-clone-kinds
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import v8 from "node:v8";
import slothlet from "@cldmv/slothlet";
import { shape } from "../../../../api_tests/api_test_api_node_clone_kinds/shape.mjs";

const FIXTURE = resolve("api_tests/api_test_api_node_clone_kinds");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
];

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

/** The owner's members that are cloned. */
const OWNER_KEYS = [
	"when",
	"byName",
	"tags",
	"failure",
	"bare",
	"pattern",
	"bytes",
	"pair",
	"view",
	"buffer",
	"growable",
	"boxedString",
	"boxedNumber",
	"boxedBoolean",
	"weak",
	"kinds"
];

/** The files whose default export is cloned. */
const SINGLE_KEYS = ["dmap", "ddate", "derror", "dbox"];

let twins = 0;

/**
 * A fresh copy of one of the fixture's files, imported as a plain module.
 * @param {string} file - The file, relative to the fixture.
 * @returns {Promise<object>} Its namespace.
 */
const twin = (file) => import(`${pathToFileURL(join(FIXTURE, file)).href}?plain-twin-${++twins}`);

/**
 * Run a check, answering what it returned or the name of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.name ?? "threw" };
	}
}

/**
 * Post a value through a channel, and describe what arrives.
 * @param {*} value - The value.
 * @returns {Promise<*>} The message's description, or `{ threw }`.
 */
async function post(value) {
	const { port1, port2 } = new MessageChannel();
	try {
		const received = new Promise((resolve) => port2.once("message", resolve));
		port1.postMessage({ held: value });
		return shape((await received).held);
	} catch (error) {
		return { threw: error?.name ?? "threw" };
	} finally {
		port1.close();
		port2.close();
	}
}

/**
 * What each cloning function makes of the plain modules' values, by module and key.
 * @returns {Promise<object>} `{ owner: { key: { clone, serialized, posted } }, single: { … } }`.
 */
async function plainAnswers() {
	const owner = await twin("owner/owner.mjs");
	const answers = { owner: {}, single: {} };
	for (const key of OWNER_KEYS) {
		answers.owner[key] = {
			clone: answer(() => shape(structuredClone(owner[key]))),
			serialized: answer(() => shape(v8.deserialize(v8.serialize(owner[key])), true)),
			posted: await post(owner[key])
		};
	}
	for (const key of SINGLE_KEYS) {
		const value = (await twin(`single/${key}.mjs`)).default;
		answers.single[key] = {
			clone: answer(() => shape(structuredClone(value))),
			serialized: answer(() => shape(v8.deserialize(v8.serialize(value)), true)),
			posted: await post(value)
		};
	}
	return answers;
}

describe.each(matrix)(
	"cloning a built-in data object read through the api > $mode / $runtime / $name",
	({ mode, runtime, permissions }) => {
		let api;

		/**
		 * Build an instance with the owner, the files of single values and the reader mounted as modules of their own.
		 * @param {object[]} [rules] - Permission rules, while the permission system is on.
		 * @returns {Promise<object>} The api.
		 */
		const mount = async (rules = []) => {
			api = await slothlet({
				base: join(FIXTURE, "host"),
				silent: true,
				mode,
				runtime,
				...(permissions ? { permissions: { ...permissions, rules } } : {})
			});
			for (const name of ["owner", "single", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
			for (const node of [api.owner, api.single, api.reader]) await node;
			for (const key of OWNER_KEYS) await api.owner[key];
			for (const key of SINGLE_KEYS) await api.single[key];
			return api;
		};

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		describe("read by another module through self", () => {
			it.each(OWNER_KEYS)("structuredClone of the owner's %s", async (key) => {
				const expected = (await plainAnswers()).owner[key];
				await mount();
				expect(await api.reader.cloned("owner", key)).toEqual(expected.clone);
			});

			it.each(OWNER_KEYS)("v8.serialize of the owner's %s", async (key) => {
				const expected = (await plainAnswers()).owner[key];
				await mount();
				expect(await api.reader.serialized("owner", key)).toEqual(expected.serialized);
			});

			it.each(OWNER_KEYS)("postMessage of the owner's %s", async (key) => {
				const expected = (await plainAnswers()).owner[key];
				await mount();
				expect(await api.reader.posted("owner", key)).toEqual(expected.posted);
			});

			it.each(SINGLE_KEYS)("structuredClone, v8.serialize and postMessage of a file's default export: %s", async (key) => {
				const expected = (await plainAnswers()).single[key];
				await mount();
				expect(await api.reader.cloned("single", key)).toEqual(expected.clone);
				expect(await api.reader.serialized("single", key)).toEqual(expected.serialized);
				expect(await api.reader.posted("single", key)).toEqual(expected.posted);
			});

			it("hands over a copy: views over one buffer still share one, and changing the copies changes nothing of the owner's", async () => {
				const owner = await twin("owner/owner.mjs");
				const pair = structuredClone(owner.pair);
				await mount();
				expect(await api.reader.changed()).toEqual({
					shares: pair.small.buffer === pair.wide.buffer,
					time: owner.time(),
					one: owner.one()
				});
			});
		});

		describe("read by the host", () => {
			it.each(OWNER_KEYS)("structuredClone of the owner's %s", async (key) => {
				const expected = (await plainAnswers()).owner[key];
				await mount();
				expect(answer(() => shape(structuredClone(api.owner[key])))).toEqual(expected.clone);
			});

			it.each(SINGLE_KEYS)("structuredClone, v8.serialize and postMessage of a file's default export: %s", async (key) => {
				const expected = (await plainAnswers()).single[key];
				await mount();
				const node = api.single[key];
				expect(answer(() => shape(structuredClone(node)))).toEqual(expected.clone);
				expect(answer(() => shape(v8.deserialize(v8.serialize(node)), true))).toEqual(expected.serialized);
				expect(await post(node)).toEqual(expected.posted);
			});
		});
	}
);

const guarded = MODES.flatMap((mode) =>
	RUNTIMES.flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

describe.each(guarded)(
	"cloning a built-in data object, permission system on > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		/**
		 * Build an instance with the owner, the files of single values and the reader mounted as modules of their own.
		 * @param {object[]} rules - The permission rules.
		 * @returns {Promise<object>} The api.
		 */
		const mount = async (rules) => {
			api = await slothlet({
				base: join(FIXTURE, "host"),
				silent: true,
				mode,
				runtime,
				permissions: { defaultPolicy: "allow", attribution, rules }
			});
			for (const name of ["owner", "single", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
			for (const node of [api.owner, api.single, api.reader, api.owner.sharedMemory, api.owner.sharedBytes, api.single.derror]) await node;
			return api;
		};

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("leaves out a member of an error the reader may not read, and copies the rest", async () => {
			const plain = shape(structuredClone((await twin("single/derror.mjs")).default));
			await mount([{ caller: "reader.**", target: "single.derror.cause", effect: "deny" }]);
			expect(await api.reader.cloned("single", "derror")).toEqual({
				...plain,
				own: plain.own.filter((key) => key !== "cause"),
				cause: "none"
			});
			await api.shutdown();
			await mount([{ caller: "reader.**", target: "single.derror.message", effect: "deny" }]);
			expect(await api.reader.cloned("single", "derror")).toEqual({
				...plain,
				own: plain.own.filter((key) => key !== "message"),
				message: ""
			});
		});

		it("refuses memory shared with the owner to a reader that may not write it, and clones it for one that may and for the host", async () => {
			const owner = await twin("owner/owner.mjs");
			const expected = [shape(structuredClone(owner.sharedMemory)), shape(structuredClone(owner.sharedBytes))];
			await mount([]);
			expect([await api.reader.cloned("owner", "sharedMemory"), await api.reader.cloned("owner", "sharedBytes")]).toEqual([
				{ threw: "DataCloneError" },
				{ threw: "DataCloneError" }
			]);
			expect([shape(structuredClone(api.owner.sharedMemory)), shape(structuredClone(api.owner.sharedBytes))]).toEqual(expected);
			await api.shutdown();
			await mount([
				{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
				{ caller: "reader.**", target: "owner:write", effect: "allow" }
			]);
			expect([await api.reader.cloned("owner", "sharedMemory"), await api.reader.cloned("owner", "sharedBytes")]).toEqual(expected);
		});
	}
);
