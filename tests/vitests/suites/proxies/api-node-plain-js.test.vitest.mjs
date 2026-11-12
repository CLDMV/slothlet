/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-plain-js.test.vitest.mjs
 *	@Date: 2026-11-11T23:30:00-08:00 (1794468600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:30:00-08:00 (1794468600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api node answers ordinary code as the module's own value does (#746–#751).
 *
 * @description
 * Each check is one function run twice: on the fixture's module imported as a plain module, and on its api node. The
 * two answers have to be equal in eager and lazy mode, the async and live runtime, with the permission system off and
 * on. The expected value is always what the plain module gave, never a value written down here.
 *
 * The last block holds what must stay refused while the permission system is on: a module with no right to write
 * another module's node changes neither the node nor that module's own object, whichever way it writes.
 * @module tests/vitests/suites/proxies/api-node-plain-js
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_plain_js");
const require = createRequire(import.meta.url);

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: { defaultPolicy: "allow" } }
];

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

let twins = 0;

/**
 * A fresh copy of one of the fixture's ES modules, imported as a plain module.
 * @param {string} file - The file under the fixture's `host` folder.
 * @returns {Promise<object>} Its namespace.
 */
const twin = (file) => import(`${pathToFileURL(join(FIXTURE, "host", file)).href}?plain-twin-${++twins}`);

/**
 * A fresh copy of the fixture's CommonJS module, required as a plain module.
 * @returns {object} Its `module.exports`.
 */
const twinLegacy = () => {
	const file = join(FIXTURE, "host", "legacy.cjs");
	delete require.cache[file];
	return require(file);
};

/**
 * Build an instance over the fixture's host folder, every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	const loaded = [
		api.shapes,
		api.shapes.config,
		api.shapes.config.nested,
		api.shapes.outer,
		api.shapes.outer.inner,
		api.shapes.frozen,
		api.shapes.partly,
		api.shapes.list,
		api.shapes.rex,
		api.shapes.Animal,
		api.shapes.Dog,
		api.shapes.arrow,
		api.shapes.named,
		api.shapes.later,
		api.settings,
		api.settings.nested,
		api.legacy,
		api.legacy.state,
		api.legacy.state.nested
	];
	for (const node of loaded) await node;
	return api;
}

/**
 * Run a check, answering what it returned or how it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }` naming the error.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.name ?? String(error) };
	}
}

/** Writes made through `m`, each answered by the module's own read of its object and by a read through `m`. */
const WRITES = {
	"an assignment": (m) => {
		m.config.port = 81;
		return [m.readPort(), m.config.port];
	},
	"an assignment to an object inside it": (m) => {
		m.config.nested.a = 2;
		return [m.readNested("a"), m.config.nested.a];
	},
	"a new member": (m) => {
		m.config.added = 1;
		return [m.read("added"), m.ownKeys(), Object.keys(m.config)];
	},
	"an object assigned": (m) => {
		m.config.held = { z: 1 };
		m.config.held.z = 2;
		return [JSON.stringify(m.read("held")), JSON.stringify(m.config.held)];
	},
	"a member replaced, which keeps its place": (m) => {
		m.config.port = 81;
		m.config.nested = { a: 3 };
		return [m.ownKeys(), Object.keys(m.config)];
	},
	"a deletion": (m) => {
		const removed = delete m.config.nested.a;
		return [removed, m.readNested("a"), "a" in m.config.nested, m.ownKeys()];
	},
	"a definition": (m) => {
		Object.defineProperty(m.config, "defined", { value: 5, writable: true, enumerable: true, configurable: true });
		return [m.read("defined"), m.describe("defined"), m.config.defined];
	},
	"a definition that leaves the attributes out": (m) => {
		Object.defineProperty(m.config, "bare", { value: 5 });
		return [m.read("bare"), m.describe("bare"), Reflect.set(m.config, "bare", 6), m.read("bare")];
	},
	"a setter that writes through this": (m) => {
		m.config.scaled = 50;
		return [m.readPort(), m.config.port, m.config.computed];
	},
	"Reflect.set": (m) => [Reflect.set(m.config, "port", 82), m.readPort()],
	"a write a frozen object refuses": (m) => [Reflect.set(m.frozen, "a", 2), m.frozen.a],
	"a write a read-only member refuses": (m) => [
		Reflect.set(m.partly, "fixed", 2),
		Reflect.set(m.partly, "open", 2),
		m.readPartly(),
		m.partly.fixed,
		m.partly.open
	],
	"a strict assignment a read-only member refuses": (m) => {
		"use strict";
		return [
			answer(() => {
				m.partly.fixed = 2;
			}),
			m.readPartly()
		];
	}
};

describe.each(matrix)("api node, plain-JS answers > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/** The api for this row. */
	const start = async () => (api = await build({ mode, runtime, ...(permissions ? { permissions } : {}) }));

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe("a write through the node reaches the module's own object (#746)", () => {
		it.each(Object.keys(WRITES))("%s", async (name) => {
			const module = await twin("shapes.mjs");
			await start();
			expect(answer(() => WRITES[name](api.shapes))).toEqual(answer(() => WRITES[name](module)));
		});

		it("an object default export beside named exports", async () => {
			const check = (settings, readers) => {
				settings.port = 81;
				settings.nested.a = 2;
				settings.extra = 1;
				return [readers.readPort(), readers.readNested("a"), readers.ownKeys()];
			};
			const module = await twin("settings.mjs");
			await start();
			expect(check(api.settings, api.settings)).toEqual(check(module.default, module));
		});

		it("a named export put beside an object default's members stays off the default object", async () => {
			const module = await twin("settings.mjs");
			await start();
			// The file's binding is no member of its default object in plain JavaScript, so the object never gains one.
			api.settings.readPort = () => 1;
			expect(api.settings.ownKeys()).toEqual(module.ownKeys());
		});

		it("a CommonJS module's object", async () => {
			const check = (m) => {
				m.state.port = 81;
				m.state.nested.a = 2;
				return [m.readPort(), m.readNested("a")];
			};
			const module = twinLegacy();
			await start();
			expect(check(api.legacy)).toEqual(check(module));
		});

		it("the module's object after the module is reloaded", async () => {
			const check = (m) => {
				m.config.nested.a = 2;
				m.config.added = 1;
				return [m.readNested("a"), m.read("added")];
			};
			const module = await twin("shapes.mjs");
			await start();
			await api.slothlet.api.reload("shapes");
			await api.shapes;
			await api.shapes.config;
			await api.shapes.config.nested;
			expect(check(api.shapes)).toEqual(check(module));
		});
	});
});

/** What the owner's own object holds before anything is written. */
const UNCHANGED = { port: 80, nested: { a: 1 }, keys: ["port", "nested"] };

/** What it holds once every change in the fixture's `change()` has been made. */
const CHANGED = { port: 82, nested: {}, keys: ["port", "nested", "added", "defined"] };

/** Lets the writer change the owner's subtree. */
const WRITER_MAY_WRITE = [
	{ caller: "writer.**", target: "owner.**:write", effect: "allow" },
	{ caller: "writer.**", target: "owner:write", effect: "allow" }
];

const guarded = MODES.flatMap((mode) =>
	RUNTIMES.flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

describe.each(guarded)("api node writes, permission system on > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	/**
	 * Build an instance with the owner, the writer and the reader mounted as modules of their own.
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
		for (const name of ["owner", "writer", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
		for (const node of [api.owner, api.owner.config, api.owner.config.nested, api.writer, api.reader]) await node;
		return api;
	};

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("refuses every change by a module with no right to write, and leaves the module's object as it was", async () => {
		await mount(WRITER_MAY_WRITE);
		const outcomes = await api.reader.change();
		for (const [change, outcome] of Object.entries(outcomes)) expect(outcome, change).toBe("LOOSE_SET_NOT_OWNED");
		expect(await api.owner.state()).toEqual(UNCHANGED);
		expect(api.owner.config.port).toBe(80);
		expect(Object.keys(api.owner.config)).toEqual(["port", "nested"]);
		expect(api.owner.config.nested.a).toBe(1);
	});

	it("refuses every change by a module a write rule denies, and leaves the module's object as it was", async () => {
		await mount([...WRITER_MAY_WRITE, { caller: "reader.**", target: "owner.**:write", effect: "deny" }]);
		const outcomes = await api.reader.change();
		for (const [change, outcome] of Object.entries(outcomes)) expect(outcome, change).toBe("PERMISSION_DENIED");
		expect(await api.owner.state()).toEqual(UNCHANGED);
		expect(api.owner.config.port).toBe(80);
	});

	it("lets a module with the right to write change the module's object", async () => {
		await mount(WRITER_MAY_WRITE);
		const outcomes = await api.writer.change();
		for (const [change, outcome] of Object.entries(outcomes)) expect(outcome, change).toBe("written");
		expect(await api.owner.state()).toEqual(CHANGED);
		expect(api.owner.config.port).toBe(82);
	});

	it("lets the host change the module's object", async () => {
		await mount([]);
		api.owner.config.port = 81;
		api.owner.config.nested.a = 2;
		api.owner.config.added = 1;
		expect(await api.owner.state()).toEqual({ port: 81, nested: { a: 2 }, keys: ["port", "nested", "added"] });
	});

	it("hands a module that may only read another module's data a node, never the module's object", async () => {
		await mount(WRITER_MAY_WRITE);
		api.owner.config.nested = { a: 5 };
		const view = await api.reader.view();
		expect(view.config).toBe(true);
		expect(view.nested).toBe(true);
		expect(view.port).toBe(80);
		expect(await api.reader.change()).toMatchObject({ assignNested: "LOOSE_SET_NOT_OWNED", remove: "LOOSE_SET_NOT_OWNED" });
		expect((await api.owner.state()).nested).toEqual({ a: 5 });
	});
});
