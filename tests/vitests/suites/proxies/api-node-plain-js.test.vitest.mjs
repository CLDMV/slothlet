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
import v8 from "node:v8";
import { inspect } from "node:util";
import slothlet from "@cldmv/slothlet";
import { isFunctionSourcePatch, isFunctionSourcePatched } from "@cldmv/slothlet/helpers/function-source-context";
import { functionSource } from "@cldmv/slothlet/helpers/intrinsics";

/** `Function.prototype.toString` as the language provides it: taken before any instance is built. */
const nativeToString = Function.prototype.toString;

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
		api.shapes.kinds,
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

/**
 * A data member's description, its value left out where it is an object (a node on one side, the object on the other).
 * @param {object} object - The object or node.
 * @param {string} key - The member's key.
 * @returns {object|undefined} The description.
 */
const described = (object, key) => {
	const descriptor = Object.getOwnPropertyDescriptor(object, key);
	if (!descriptor) return descriptor;
	if ("value" in descriptor && descriptor.value !== null && typeof descriptor.value === "object") delete descriptor.value;
	for (const half of ["get", "set"]) if (half in descriptor) descriptor[half] = typeof descriptor[half];
	return descriptor;
};

/** How `m` describes the members of its exports. */
const DESCRIPTIONS = {
	"a data member": (m) => described(m.config, "port"),
	"a member holding an object": (m) => described(m.config, "nested"),
	"a member of an object inside it": (m) => described(m.config.nested, "a"),
	"an accessor": (m) => described(m.config, "computed"),
	"every member at once": (m) => Object.entries(Object.getOwnPropertyDescriptors(m.config)).map(([key, value]) => [key, value.writable]),
	"a frozen object's member": (m) => described(m.frozen, "a"),
	"a member the object keeps read-only": (m) => [described(m.partly, "fixed"), described(m.partly, "open")],
	"a class instance's field": (m) => described(m.rex, "name"),
	"a member written through the node": (m) => {
		m.config.port = 81;
		m.config.added = 1;
		return [described(m.config, "port"), described(m.config, "added")];
	},
	"a member defined read-only through the node": (m) => {
		Object.defineProperty(m.config, "locked", { value: 1, enumerable: true, configurable: true });
		return [described(m.config, "locked"), Reflect.set(m.config, "locked", 2), m.config.locked];
	},
	"a member defined on a namespace of functions": (m) => {
		Object.defineProperty(m.arrow, "locked", { value: 1, enumerable: true, configurable: true });
		Object.defineProperty(m.arrow, "open", { value: 1, writable: true, enumerable: true, configurable: true });
		m.arrow.assigned = 1;
		const before = [described(m.arrow, "locked"), described(m.arrow, "open"), described(m.arrow, "assigned")];
		const written = [Reflect.set(m.arrow, "locked", 2), Reflect.set(m.arrow, "open", 2), m.arrow.locked, m.arrow.open];
		Object.defineProperty(m.arrow, "locked", { writable: true });
		return [before, written, described(m.arrow, "locked"), Reflect.set(m.arrow, "locked", 3), m.arrow.locked];
	},
	"a sealed object's member": (m) => {
		Object.seal(m.config.nested);
		return [described(m.config.nested, "a"), Object.isSealed(m.config.nested), Object.isFrozen(m.config.nested)];
	},
	"what Object.isFrozen answers for an open object": (m) => [Object.isFrozen(m.config), Object.isFrozen(m.frozen)]
};

/** What `JSON.stringify` makes of `m`'s exports. */
const SERIALIZED = {
	"an object with a getter that reads this": (m) => JSON.stringify(m.config),
	"an object holding one with getters, one answering an object": (m) => JSON.stringify(m.outer),
	"the object inside it": (m) => JSON.stringify(m.outer.inner),
	"indented": (m) => JSON.stringify(m.config, null, 2),
	"inside a plain object and an array": (m) => JSON.stringify({ held: m.config, list: [m.outer] }),
	"through a replacer": (m) => {
		const seen = [];
		const text = JSON.stringify(m.config, (key, value) => {
			seen.push(key);
			return value;
		});
		return [text, seen];
	},
	"after a member is replaced and one is added": (m) => {
		m.config.port = 81;
		m.config.added = 1;
		return JSON.stringify(m.config);
	},
	"a frozen object": (m) => JSON.stringify(m.frozen),
	"a class instance": (m) => JSON.stringify(m.rex),
	"a list": (m) => JSON.stringify(m.list),
	"a function": (m) => [JSON.stringify(m.arrow), JSON.stringify({ held: m.arrow })]
};

/** What the platform's cloning functions make of `m`'s exports: each clone printed, so its kinds and members show. */
const CLONED = {
	"an object inside an exported object": (m) => inspect(structuredClone(m.config.nested)),
	"an exported object with a getter": (m) => inspect(structuredClone(m.config)),
	"an object holding one with getters": (m) => inspect(structuredClone(m.outer), { depth: 5 }),
	"a frozen object, whose clone is open": (m) => {
		const copy = structuredClone(m.frozen);
		return [inspect(copy), Object.isFrozen(copy)];
	},
	"a list": (m) => {
		const copy = structuredClone(m.list);
		return [Array.isArray(copy), copy.length, inspect(copy)];
	},
	"a class instance, cloned as a plain object": (m) => {
		const copy = structuredClone(m.rex);
		return [inspect(copy), Object.getPrototypeOf(copy) === Object.prototype];
	},
	"dates, sets, maps, bytes and patterns": (m) => inspect(structuredClone(m.kinds), { depth: 5 }),
	"nodes inside the caller's own object and array": (m) =>
		inspect(structuredClone({ held: m.config.nested, list: [m.frozen, 1] }), { depth: 5 }),
	"the same node twice, cloned once": (m) => {
		const copy = structuredClone({ first: m.config.nested, second: m.config.nested });
		return copy.first === copy.second;
	},
	"a clone is a copy: changing it changes nothing": (m) => {
		const copy = structuredClone(m.config);
		copy.port = -1;
		copy.nested.a = -1;
		return [m.readPort(), m.readNested("a"), m.config.port, m.config.nested.a];
	},
	"after a write through the node": (m) => {
		m.config.nested.a = 2;
		m.config.added = { deep: true };
		return inspect(structuredClone(m.config), { depth: 5 });
	},
	"a function, which is refused": (m) => answer(() => structuredClone(m.arrow)),
	"an object holding a function, which is refused": (m) => answer(() => structuredClone({ held: m.named })),
	"a class, which is refused": (m) => answer(() => structuredClone(m.Animal)),
	"a whole module, which holds functions": (m) => answer(() => structuredClone(m)),
	"v8.serialize": (m) => inspect(v8.deserialize(v8.serialize(m.config)), { depth: 5 }),
	"a message posted through a channel": async (m) => {
		const { port1, port2 } = new MessageChannel();
		const received = new Promise((resolve) => port2.once("message", resolve));
		port1.postMessage({ held: m.config.nested, list: m.list });
		const message = await received;
		port1.close();
		port2.close();
		return inspect(message, { depth: 5 });
	}
};

/** What the language's own `Function.prototype.toString` answers for `m`'s exports, and what goes with it. */
const SOURCES = {
	"an arrow function": (m) => Function.prototype.toString.call(m.arrow),
	"a function declaration": (m) => Function.prototype.toString.call(m.named),
	"an async function": (m) => Function.prototype.toString.call(m.later),
	"a class": (m) => Function.prototype.toString.call(m.Animal),
	"a derived class": (m) => Function.prototype.toString.call(m.Dog),
	"the same text as the function's own toString()": (m) => Function.prototype.toString.call(m.arrow) === m.arrow.toString(),
	"a function with a toString of its own, which the language's ignores": (m) => {
		m.named.toString = () => "function named() { [native code] }";
		return [Function.prototype.toString.call(m.named), String(m.named)];
	},
	"a captured toString applied later": (m) => {
		const { toString } = Function.prototype;
		return [toString.call(m.arrow), Reflect.apply(toString, m.named, [])];
	},
	"a bound copy of a function, which is native code": (m) => Function.prototype.toString.call(m.arrow.bind(null)),
	"an instance's constructor": (m) => Function.prototype.toString.call(m.rex.constructor),
	"an object, which is refused": (m) => answer(() => Function.prototype.toString.call(m.config)),
	"an array, which is refused": (m) => answer(() => Function.prototype.toString.call(m.list)),
	"a module, which is refused": (m) => answer(() => Function.prototype.toString.call(m)),
	"a built-in function": () => [Function.prototype.toString.call(Math.max), Function.prototype.toString.call(Function.prototype.toString)],
	"an ordinary function and non-functions": () => [
		Function.prototype.toString.call(() => 1),
		answer(() => Function.prototype.toString.call({})),
		answer(() => Function.prototype.toString.call(undefined)),
		answer(() => Function.prototype.toString.call("text"))
	],
	"what the function reports about itself": () => [
		Function.prototype.toString.name,
		Function.prototype.toString.length,
		"prototype" in Function.prototype.toString,
		Object.keys(Function.prototype.toString),
		Object.getOwnPropertyDescriptor(Function.prototype, "toString").enumerable
	]
};

describe.each(matrix)("api node, plain-JS answers > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/** The api for this row. */
	const start = async () => (api = await build({ mode, runtime, ...(permissions ? { permissions } : {}) }));

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe("a member is described as the module's own object describes it (#749)", () => {
		it.each(Object.keys(DESCRIPTIONS))("%s", async (name) => {
			const module = await twin("shapes.mjs");
			await start();
			expect(answer(() => DESCRIPTIONS[name](api.shapes))).toEqual(answer(() => DESCRIPTIONS[name](module)));
		});
	});

	describe("JSON.stringify serializes a node as it serializes the module's own object (#747)", () => {
		it.each(Object.keys(SERIALIZED))("%s", async (name) => {
			const module = await twin("shapes.mjs");
			await start();
			expect(answer(() => SERIALIZED[name](api.shapes))).toEqual(answer(() => SERIALIZED[name](module)));
		});
	});

	describe("the platform clones a node's data as it clones the module's own object (#751)", () => {
		it.each(Object.keys(CLONED))("%s", async (name) => {
			const module = await twin("shapes.mjs");
			const expected = await answer(() => CLONED[name](module));
			await start();
			expect(await answer(() => CLONED[name](api.shapes))).toEqual(expected);
		});
	});

	describe("Function.prototype.toString answers a node of a function as it answers the function (#750)", () => {
		it.each(Object.keys(SOURCES))("%s", async (name) => {
			const module = await twin("shapes.mjs");
			const expected = answer(() => SOURCES[name](module));
			await start();
			expect(answer(() => SOURCES[name](api.shapes))).toEqual(expected);
		});

		it("is wrapped once while instances are up and put back when the last one shuts down", async () => {
			expect(Function.prototype.toString).toBe(nativeToString);
			await start();
			const wrapped = Function.prototype.toString;
			expect(wrapped).not.toBe(nativeToString);
			expect(isFunctionSourcePatch(wrapped)).toBe(true);
			expect(isFunctionSourcePatched(wrapped)).toBe(true);
			const second = await build({ mode, runtime, ...(permissions ? { permissions } : {}) });
			expect(Function.prototype.toString).toBe(wrapped);
			await api.shutdown();
			api = null;
			expect(Function.prototype.toString).toBe(wrapped);
			expect(Function.prototype.toString.call(second.shapes.arrow)).toBe(nativeToString.call((await twin("shapes.mjs")).arrow));
			await second.shutdown();
			expect(Function.prototype.toString).toBe(nativeToString);
			// A copy kept from while it was wrapped answers as the language's own does from then on.
			expect(wrapped.call(Math.max)).toBe(nativeToString.call(Math.max));
			expect(wrapped.call(second.shapes.arrow)).toBe(nativeToString.call(second.shapes.arrow));
		});

		it("is told by identity, so a function carrying the wrapper's marker is not taken for it", async () => {
			await start();
			const forged = Object.defineProperty(() => "forged", Symbol.for("slothlet.functionSource.original"), { value: nativeToString });
			expect(isFunctionSourcePatched(forged)).toBe(true);
			expect(isFunctionSourcePatch(forged)).toBe(false);
		});

		it("leaves slothlet's own read of a function's text on the language's toString, whatever is installed later", async () => {
			await start();
			const installed = Function.prototype.toString;
			const fn = () => 1;
			try {
				Function.prototype.toString = () => "function max() { [native code] }";
				expect(functionSource(fn)).toBe(nativeToString.call(fn));
				expect(functionSource(api.shapes.arrow)).toBe(nativeToString.call(api.shapes.arrow));
			} finally {
				Function.prototype.toString = installed;
			}
			// A node is a Proxy to the language's own toString: slothlet never reads a node's text as a built-in's name.
			expect(functionSource(api.shapes.arrow)).toBe("function () { [native code] }");
		});
	});

	describe("a getter of an exported object stays a getter when its module is reloaded", () => {
		it("is described, read and serialized after a reload as on the module's own object", async () => {
			const check = (m) => {
				m.config.port = 5;
				return [described(m.config, "computed"), m.config.computed, m.outer.inner.twice, JSON.stringify(m.config), JSON.stringify(m.outer)];
			};
			const module = await twin("shapes.mjs");
			await start();
			await api.slothlet.api.reload("shapes");
			for (const node of [api.shapes, api.shapes.config, api.shapes.config.nested, api.shapes.outer, api.shapes.outer.inner]) await node;
			expect(check(api.shapes)).toEqual(check(module));
		});
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
const UNCHANGED = { port: 80, nested: { a: 1 }, keys: ["port", "nested", "doubled"] };

/** What it holds once every change in the fixture's `change()` has been made. */
const CHANGED = { port: 82, nested: {}, keys: ["port", "nested", "doubled", "added", "defined"] };

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
		expect(Object.keys(api.owner.config)).toEqual(["port", "nested", "doubled"]);
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
		expect(await api.owner.state()).toEqual({ port: 81, nested: { a: 2 }, keys: ["port", "nested", "doubled", "added"] });
	});

	it("serializes another module's data for a module as the module's own object serializes", async () => {
		await mount(WRITER_MAY_WRITE);
		const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
		expect(await api.reader.serialize()).toBe(JSON.stringify(owner.config));
	});

	it("leaves a getter out for a module that may not read it, and still runs it for one that may", async () => {
		await mount([{ caller: "reader.**", target: "owner.config.doubled", effect: "deny" }]);
		const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
		const readable = { port: owner.config.port, nested: owner.config.nested };
		expect(await api.reader.serialize()).toBe(JSON.stringify(readable));
		expect(await api.writer.serialize()).toBe(JSON.stringify(owner.config));
	});

	it("clones another module's data for a module as a copy, which changes nothing of the owner's when changed", async () => {
		await mount(WRITER_MAY_WRITE);
		const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
		const expected = JSON.stringify(structuredClone(owner.config));
		expect(await api.reader.clone()).toBe(expected);
		expect(await api.writer.clone()).toBe(expected);
		expect(await api.owner.state()).toEqual(UNCHANGED);
	});

	it("never copies out a member the cloning module may not read", async () => {
		await mount([
			{ caller: "reader.**", target: "owner.config.nested", effect: "deny" },
			{ caller: "reader.**", target: "owner.config.nested.**", effect: "deny" }
		]);
		const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
		const cloned = await api.reader.clone();
		// Refused outright, or copied with nothing the reader may not read: either way no member of `nested` leaves.
		if (cloned !== "DataCloneError") {
			const { nested = {}, ...rest } = JSON.parse(cloned);
			expect(nested).toEqual({});
			expect(rest).toEqual({ port: owner.config.port, doubled: owner.config.doubled });
		}
		expect(await api.writer.clone()).toBe(JSON.stringify(structuredClone(owner.config)));
		expect(await api.owner.state()).toEqual(UNCHANGED);
	});

	it("answers a module the source of another module's functions as plain JavaScript does", async () => {
		await mount(WRITER_MAY_WRITE);
		const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
		const source = (fn) => nativeToString.call(fn);
		const expected = {
			node: source(owner.state),
			nodeOwn: owner.state.toString(),
			nodeString: String(owner.state),
			returned: source(owner.maker()),
			returnedOwn: owner.maker().toString(),
			inData: source(owner.bag().run),
			inDataOwn: owner.bag().run.toString(),
			builtin: source(Math.max),
			itself: source(nativeToString)
		};
		expect(await api.reader.sources()).toEqual(expected);
		expect(await api.writer.sources()).toEqual(expected);
		expect(Function.prototype.toString.call(api.owner.maker())).toBe(expected.returned);
		expect(Function.prototype.toString.call(api.owner.bag().run)).toBe(expected.inData);
	});

	it("answers a function's source the same through the language's toString and the function's own", async () => {
		await mount([{ caller: "reader.**", target: "owner.state", effect: "deny" }]);
		const sources = await api.reader.sources();
		// Whatever a module denied the call gets from the function's own toString(), the language's gives it no more.
		expect(sources.node).toBe(sources.nodeOwn);
		expect(sources.nodeString).toBe(sources.nodeOwn);
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
