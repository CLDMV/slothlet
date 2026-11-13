/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-module-object.test.vitest.mjs
 *	@Date: 2026-11-13T10:00:00-08:00 (1794592800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T10:00:00-08:00 (1794592800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api node of a module's own data object follows what the module does to the object, and closing the
 * node or giving it a prototype reaches the object (#757).
 *
 * @description
 * Each check is one function run twice: on the fixture's module imported as a plain module, and on its api node. The
 * two answers have to be equal in eager and lazy mode, the async and live runtime, with the permission system off and
 * on (both attributions). The expected value is always what the plain module gave.
 *
 * The last block holds what must stay refused while the permission system is on: a module with no right to write
 * another module's node neither closes it nor gives it a prototype, and that module's object stays as it was.
 * @module tests/vitests/suites/proxies/api-node-module-object
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_module_object");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
];

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

let twins = 0;

/**
 * A fresh copy of the fixture's host module, imported as a plain module.
 * @returns {Promise<object>} Its namespace.
 */
const twin = () => import(`${pathToFileURL(join(FIXTURE, "host", "state.mjs")).href}?plain-twin-${++twins}`);

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

/**
 * A member's description, its value left out where it is an object (a node on one side, the object on the other).
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

/** Changes the module makes to its own object, each answered by reads through `m`. */
const MODULE_CHANGES = {
	"a member changed": (m) => {
		void m.config.port;
		m.setPort(90);
		return [m.config.port, m.config.computed, JSON.stringify(m.config), described(m.config, "port")];
	},
	"a member changed before anything read it": (m) => {
		m.setPort(91);
		return [m.config.port, { ...m.config }];
	},
	"an object it holds replaced": (m) => {
		void m.config.nested.a;
		m.replaceNested();
		return [m.config.nested.b, m.config.nested.a, Object.keys(m.config.nested), JSON.stringify(m.config)];
	},
	"a member of an object it holds changed": (m) => {
		void m.config.nested.a;
		m.setNested(5);
		return [m.config.nested.a, JSON.stringify(m.config)];
	},
	"a member added": (m) => {
		void m.config.port;
		m.addMember();
		return [m.config.extra.deep, "extra" in m.config, Object.keys(m.config), JSON.stringify(m.config), described(m.config, "extra")];
	},
	"a member deleted": (m) => {
		void m.config.port;
		m.removeMember();
		return [m.config.port, "port" in m.config, Object.keys(m.config), described(m.config, "port"), JSON.stringify(m.config)];
	},
	"a getter replaced by a value": (m) => {
		void m.config.computed;
		m.replaceGetter();
		return [m.config.computed, described(m.config, "computed")];
	},
	"a write through the node, then the module's own": (m) => {
		m.config.port = 81;
		m.setPort(90);
		return [m.config.port, m.state()];
	},
	"the object frozen": (m) => {
		void m.config.port;
		m.freeze();
		return [Object.isFrozen(m.config), Object.isExtensible(m.config), Reflect.set(m.config, "port", 1), m.config.port, m.state()];
	},
	"a prototype given to the object": (m) => {
		void m.config.port;
		m.inherit({ kind: "mine", tag: 7 });
		return [m.config.tag, "tag" in m.config, Object.getPrototypeOf(m.config).kind, Object.keys(m.config), m.state()];
	}
};

/** Changes made through `m`, each answered by the module's own read of its object and by reads through `m`. */
const NODE_CHANGES = {
	"Object.freeze": (m) => {
		Object.freeze(m.config);
		return [m.state(), Object.isFrozen(m.config), Reflect.set(m.config, "port", 1), m.config.port, Reflect.set(m.config, "added", 1)];
	},
	"Object.seal": (m) => {
		Object.seal(m.config);
		return [
			m.state(),
			Object.isSealed(m.config),
			Reflect.set(m.config, "port", 1),
			m.config.port,
			Reflect.deleteProperty(m.config, "port")
		];
	},
	"Object.preventExtensions": (m) => {
		Object.preventExtensions(m.config);
		return [m.state(), Object.isExtensible(m.config), Reflect.set(m.config, "added", 1), "added" in m.config];
	},
	"Object.freeze of an object it holds": (m) => {
		Object.freeze(m.config.nested);
		return [m.state(), Object.isFrozen(m.config.nested), answer(() => m.setNested(9)), m.config.nested.a];
	},
	"Reflect.setPrototypeOf": (m) => {
		const prototype = { kind: "given", tag: 3 };
		return [
			Reflect.setPrototypeOf(m.config, prototype),
			Object.getPrototypeOf(m.config) === prototype,
			m.config.tag,
			"tag" in m.config,
			m.state()
		];
	},
	"Object.setPrototypeOf to null": (m) => {
		Object.setPrototypeOf(m.config, null);
		return [Object.getPrototypeOf(m.config), m.state()];
	},
	"Reflect.setPrototypeOf on a frozen object": (m) => {
		Object.freeze(m.config);
		return [Reflect.setPrototypeOf(m.config, { kind: "late" }), m.state()];
	},
	"__proto__ assigned an object": (m) => {
		const prototype = { kind: "given", tag: 3 };
		m.config.__proto__ = prototype;
		return [Object.getPrototypeOf(m.config) === prototype, m.config.tag, Object.keys(m.config), m.state()];
	},
	"__proto__ assigned a primitive, which changes nothing": (m) => {
		m.config.__proto__ = 5;
		return [Object.keys(m.config), m.state()];
	},
	"its prototype read": (m) => [
		Object.getPrototypeOf(m.config) === Object.prototype,
		m.config.__proto__ === Object.prototype,
		m.config instanceof Object
	]
};

describe.each(matrix)("api node of a module's own object > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/**
	 * Build an instance over the fixture's host folder, the nodes the checks touch loaded.
	 * @returns {Promise<object>} The api's node of the host module.
	 */
	const start = async () => {
		api = await slothlet({ base: join(FIXTURE, "host"), silent: true, mode, runtime, ...(permissions ? { permissions } : {}) });
		await api.state;
		await api.state.config;
		await api.state.config.nested;
		return api.state;
	};

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe("a change the module makes to its object is seen through the node", () => {
		it.each(Object.keys(MODULE_CHANGES))("%s", async (name) => {
			const module = await twin();
			const node = await start();
			expect(answer(() => MODULE_CHANGES[name](node))).toEqual(answer(() => MODULE_CHANGES[name](module)));
		});
	});

	describe("closing the node or giving it a prototype reaches the module's object", () => {
		it.each(Object.keys(NODE_CHANGES))("%s", async (name) => {
			const module = await twin();
			const node = await start();
			expect(answer(() => NODE_CHANGES[name](node))).toEqual(answer(() => NODE_CHANGES[name](module)));
		});
	});
});

/** The changes the fixture's reader and writer try. */
const HOW = ["freeze", "seal", "preventExtensions", "freezeNested", "setPrototypeOf", "__proto__"];

/** Each change the reader and writer try, as made to the owner's object itself. */
const PLAIN_CHANGES = {
	freeze: (config) => Object.freeze(config),
	seal: (config) => Object.seal(config),
	preventExtensions: (config) => Object.preventExtensions(config),
	freezeNested: (config) => Object.freeze(config.nested),
	setPrototypeOf: (config) => Object.setPrototypeOf(config, { kind: "theirs" }),
	__proto__: (config) => {
		config.__proto__ = { kind: "theirs" };
	}
};

/**
 * What the owner's object is in plain JavaScript, before anything changes it or after one of the changes.
 * @param {string} [how] - The change, if any.
 * @returns {Promise<object>} The owner's own answer about its object.
 */
async function plainOwner(how) {
	const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
	if (how) PLAIN_CHANGES[how](owner.config);
	return owner.state();
}

/** Lets the writer change the owner's subtree. */
const WRITER_MAY_WRITE = [
	{ caller: "writer.**", target: "owner.**:write", effect: "allow" },
	{ caller: "writer.**", target: "owner:write", effect: "allow" }
];

const guarded = MODES.flatMap((mode) =>
	RUNTIMES.flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

describe.each(guarded)(
	"closing a node or giving it a prototype, permission system on > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		/**
		 * Build an instance with the owner, the reader and the writer mounted as modules of their own.
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
			for (const name of ["owner", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
			for (const node of [api.owner, api.owner.config, api.owner.config.nested, api.reader, api.writer]) await node;
			return api;
		};

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it.each(HOW)("refuses %s to a module with no right to write, and leaves the module's object as it was", async (how) => {
			await mount(WRITER_MAY_WRITE);
			const unchanged = await plainOwner();
			expect(await api.reader.change(how)).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.owner.state()).toEqual(unchanged);
		});

		it.each(HOW)("refuses %s to a module a write rule denies, and leaves the module's object as it was", async (how) => {
			await mount([
				...WRITER_MAY_WRITE,
				{ caller: "reader.**", target: "owner.**:write", effect: "deny" },
				{ caller: "reader.**", target: "owner:write", effect: "deny" }
			]);
			const unchanged = await plainOwner();
			expect(await api.reader.change(how)).toBe("PERMISSION_DENIED");
			expect(await api.owner.state()).toEqual(unchanged);
		});

		it.each(HOW)("lets a module with the right to write %s the module's object", async (how) => {
			const changed = await plainOwner(how);
			await mount(WRITER_MAY_WRITE);
			expect(await api.writer.change(how)).toBe("done");
			expect(await api.owner.state()).toEqual(changed);
		});
	}
);
