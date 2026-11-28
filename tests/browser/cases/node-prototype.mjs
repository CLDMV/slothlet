/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/cases/node-prototype.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:48-08:00 (1795869048)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a prototype given to a function node, a namespace slothlet composed or a function api root is
 * reported and inherited from as on a plain value, and what the node inherits is read under the rules its own members are (#802).
 *
 * @description
 * The expected values of the first row are the same operations on a plain object or function. Eager and lazy mode, the
 * async and live runtime, both attributions.
 * @module tests/browser/cases/node-prototype
 */

import { matrix, settled } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_node_set_prototype";
const FILES = ["leaf.mjs", "grp/fn.mjs", "sub/lay.mjs", "sub/other.mjs"];

/** The nodes, each with a plain value of its kind. */
const NODES = [
	["leaf", () => ({ only() {}, untouched() {} })],
	["leaf.only", () => function only() {}],
	["grp", () => function fn() {}],
	["sub.lay", () => Object.assign(function lay() {}, { side: 1, untouched() {} })]
];

/**
 * The node at a dotted path.
 * @param {object} root - Where to start.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (root, path) => path.split(".").reduce((node, key) => node[key], root);

/**
 * The names `for…in` lists that the value does not hold itself.
 * @param {object|Function} value - The value.
 * @returns {string[]} The names.
 */
function inheritedNames(value) {
	const own = Object.keys(value);
	const names = [];
	for (const name in value) if (!own.includes(name)) names.push(name);
	return names;
}

/**
 * Give a value a prototype, then none, answering what each step shows.
 * @param {object|Function} value - A plain value, or the node standing for one.
 * @returns {object} What it showed.
 */
function observe(value) {
	const prototype = {
		inherited: 5,
		hello() {
			return "hi";
		}
	};
	const first = Object.getPrototypeOf(value);
	const shown = { first: first === Object.prototype ? "object" : first === Function.prototype ? "function" : "other" };
	shown.set = Reflect.setPrototypeOf(value, prototype);
	shown.reported = [Object.getPrototypeOf(value) === prototype, value.__proto__ === prototype];
	shown.reads = [value.inherited, value.hello(), "inherited" in value, Object.hasOwn(value, "inherited"), inheritedNames(value)];
	shown.kind = [value instanceof Object, value instanceof Function, typeof value.toString, typeof value.call];
	shown.setNull = Reflect.setPrototypeOf(value, null);
	shown.none = [Object.getPrototypeOf(value), value.inherited, value.toString, "toString" in value, value instanceof Object];
	shown.setBack = Reflect.setPrototypeOf(value, first);
	shown.back = [Object.getPrototypeOf(value) === first, typeof value.toString];
	Object.setPrototypeOf(value, prototype);
	Object.freeze(value);
	// A closed node or root reports a checked view of the prototype it was given, to the host too: compared by what the
	// reported prototype holds.
	shown.closed = [
		Object.getPrototypeOf(value).inherited,
		value.inherited,
		Reflect.setPrototypeOf(value, {}),
		Reflect.setPrototypeOf(value, Object.getPrototypeOf(value))
	];
	return shown;
}

/**
 * Build an instance over the fixture's host folder with the reader module added, every node loaded. The reader's
 * folder is mounted under a name of its own in the manifest, so its file keeps its node: `api.reader.reader`.
 * @param {object} env - The environment.
 * @param {object} config - The row's config.
 * @param {object} permissions - The permission settings.
 * @returns {Promise<object>} The api.
 */
async function build(env, config, permissions) {
	const api = await env.compose({
		fixture: FIXTURE,
		root: "host",
		files: FILES,
		options: { mode: config.mode, runtime: config.runtime, permissions: { caller: { attribution: config.attribution }, ...permissions } }
	});
	await api.slothlet.api.add("reader", env.mountTarget(api, { from: "reader", files: ["reader.mjs"] }), { id: "reader" });
	for (const path of ["leaf", "leaf.only", "grp", "sub", "sub.lay", "sub.other", "reader", "reader.reader"]) await at(api, path);
	return api;
}

/**
 * Give a function a prototype, then none, then close it with one, answering what each step shows.
 * @param {Function} value - A plain function, or the api root standing for one.
 * @returns {object} What it showed.
 */
function observeRoot(value) {
	const prototype = {
		inherited: 5,
		hello() {
			return "hi";
		}
	};
	const first = Object.getPrototypeOf(value);
	const shown = { first: [value.__proto__ === first, value instanceof Function, typeof value.call] };
	shown.set = Reflect.setPrototypeOf(value, prototype);
	shown.reported = [Object.getPrototypeOf(value) === prototype, value.__proto__ === prototype];
	shown.reads = [value.inherited, value.hello(), "inherited" in value, Object.hasOwn(value, "inherited"), inheritedNames(value)];
	shown.kind = [typeof value, value instanceof Object, value instanceof Function, typeof value.toString, typeof value.call];
	shown.setNull = Reflect.setPrototypeOf(value, null);
	shown.none = [Object.getPrototypeOf(value), value.inherited, value.toString, value.call, "toString" in value];
	shown.setBack = Reflect.setPrototypeOf(value, first);
	shown.back = [Object.getPrototypeOf(value) === first, typeof value.call];
	Object.setPrototypeOf(value, prototype);
	Object.preventExtensions(value);
	// A closed node or root reports a checked view of the prototype it was given, to the host too: compared by what the
	// reported prototype holds.
	shown.closed = [
		Object.getPrototypeOf(value).inherited,
		value.inherited,
		Reflect.setPrototypeOf(value, {}),
		Reflect.setPrototypeOf(value, Object.getPrototypeOf(value))
	];
	return shown;
}

/** Rules letting one leaf of the writer read one member the root inherits, and its lister list it. */
const ROOT_RULES = [
	{ caller: "w.ops.protoRead", target: "inherited", effect: "allow" },
	{ caller: "w.ops.protoListed", target: "inherited", effect: "allow" }
];

export const rows = [
	{
		title: "the prototype a module is handed of the api root reads and lists each member as the root does",
		configs: matrix(),
		async run(env, config) {
			const checks = [];
			for (const root of ["objroot", "fnroot"]) {
				const files = root === "objroot" ? ["data.mjs", "pnum.mjs", "tool.mjs"] : ["data.mjs", "pnum.mjs", "root.mjs", "tool.mjs"];
				const api = await env.compose({
					fixture: "api_tests/api_test_api_root_integrity",
					root,
					files,
					options: {
						mode: config.mode,
						runtime: config.runtime,
						permissions: { caller: { attribution: config.attribution }, policy: "deny", rules: ROOT_RULES }
					}
				});
				try {
					await api.slothlet.api.add("w", env.mountTarget(api, { from: "writer", files: ["ops.mjs"] }), { id: "w" });
					await api.w.ops;
					const prototype = { inherited: 5, unruled: 6 };
					Object.setPrototypeOf(api, prototype);
					const throughRoot = api.w.ops.protoRead("given", "unruled", api, 0);
					checks.push(
						[`${root}: the host's is the object`, [Object.getPrototypeOf(api) === prototype, api.unruled], [true, 6]],
						[`${root}: read through the root`, api.w.ops.protoRead("given", "inherited", api, 0), 5],
						[`${root}: read from the prototype`, api.w.ops.protoRead("given", "inherited", api, 1), 5],
						[`${root}: refused through the root`, throughRoot.code, "PERMISSION_DENIED"],
						[`${root}: refused from the prototype the same way`, api.w.ops.protoRead("given", "unruled", api, 1), throughRoot],
						[`${root}: another leaf`, api.w.ops.protoPeek("given", "inherited", api, 1).code, "PERMISSION_DENIED"],
						[
							`${root}: listed`,
							api.w.ops.protoListed("given", api, prototype, ["inherited", "unruled"]),
							{
								same: false,
								stable: true,
								keys: ["inherited"],
								ownKeys: ["inherited"],
								forIn: ["inherited"],
								spread: ["inherited"],
								json: '{"inherited":5}',
								has: [true, true],
								described: [true, false]
							}
						]
					);
				} finally {
					await api.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a function api root takes, reports, inherits from and closes with a prototype as a plain function does",
		configs: matrix(),
		async run(env, config) {
			const checks = [];
			for (const [root, plain] of [
				["fnroot", () => function root() {}],
				["asyncroot", () => async function root() {}]
			]) {
				const api = await env.compose({
					fixture: "api_tests/api_test_api_root_integrity",
					root,
					files: ["data.mjs", "pnum.mjs", "root.mjs", "tool.mjs"],
					options: {
						mode: config.mode,
						runtime: config.runtime,
						permissions: { caller: { attribution: config.attribution }, policy: "allow" }
					}
				});
				try {
					checks.push([root, observeRoot(api), observeRoot(plain())]);
					checks.push([`${root} still calls`, [typeof api, await api()], ["function", "root"]]);
				} finally {
					await api.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a node takes, reports, inherits from and closes with a prototype as its plain twin does",
		configs: matrix(),
		async run(env, config) {
			const checks = [];
			for (const [path, plain] of NODES) {
				const api = await build(env, config, { policy: "allow" });
				try {
					checks.push([path, observe(at(api, path)), observe(plain())]);
					if (path !== "leaf") checks.push([`${path} is a function`, typeof at(api, path), "function"]);
					checks.push([
						"the module's functions keep their prototype",
						[await api.leaf.untouched(), await api.sub.lay.untouched()],
						[true, true]
					]);
				} finally {
					await api.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "an inherited member is read under the rules a member of the node's own is, and another module is refused the change",
		configs: matrix(),
		async run(env, config) {
			const paths = ["leaf", "leaf.only", "sub.lay"];
			const rules = paths.flatMap((path) => [
				{ caller: "reader.reader.read", target: `${path}.inherited`, effect: "allow" },
				{ caller: "reader.reader.read", target: `${path}.ownData`, effect: "allow" },
				{ caller: "reader.reader.call", target: `${path}.hello`, effect: "allow" },
				{ caller: "reader.reader.listed", target: `${path}.inherited`, effect: "allow" }
			]);
			const api = await build(env, config, { policy: "deny", rules });
			try {
				const checks = [];
				for (const path of paths) {
					const node = at(api, path);
					const prototype = {
						inherited: 5,
						unruled: 6,
						hello() {
							return "hi";
						},
						bye() {
							return "bye";
						}
					};
					Object.setPrototypeOf(node, prototype);
					node.ownData = 5;
					node.ownUnruled = 6;
					checks.push(
						[`${path}: the host reads`, [node.inherited, node.unruled, node.hello(), node.bye()], [5, 6, "hi", "bye"]],
						[`${path}: the ruled leaf reads`, await settled(() => api.reader.reader.read(path, "inherited")), 5],
						[`${path}: without a rule`, await settled(() => api.reader.reader.read(path, "unruled")), { threw: "PERMISSION_DENIED" }],
						[`${path}: another leaf`, await settled(() => api.reader.reader.peek(path, "inherited")), { threw: "PERMISSION_DENIED" }],
						[
							`${path}: as its own member`,
							await settled(() => api.reader.reader.read(path, "unruled")),
							await settled(() => api.reader.reader.read(path, "ownUnruled"))
						],
						[
							`${path}: as its own member, ruled`,
							await settled(() => api.reader.reader.read(path, "inherited")),
							await settled(() => api.reader.reader.read(path, "ownData"))
						],
						[`${path}: a ruled call`, await settled(() => api.reader.reader.call(path, "hello")), "hi"],
						[`${path}: a call without a rule`, await settled(() => api.reader.reader.call(path, "bye")), { threw: "PERMISSION_DENIED" }],
						[
							`${path}: shown`,
							await settled(() => api.reader.reader.shown(path, "unruled", prototype)),
							{ has: true, own: false, same: false }
						],
						// The prototype the module is handed reads and lists each member as the node does; the host has the object.
						[`${path}: the host's is the object`, Object.getPrototypeOf(node) === prototype, true],
						[`${path}: read from the prototype`, await settled(() => api.reader.reader.read(path, "inherited", 1)), 5],
						[
							`${path}: refused from the prototype as through the node`,
							await settled(() => api.reader.reader.refusal(path, "unruled", 1)),
							await settled(() => api.reader.reader.refusal(path, "unruled", 0))
						],
						[`${path}: refused`, (await settled(() => api.reader.reader.refusal(path, "unruled", 1))).code, "PERMISSION_DENIED"],
						[
							`${path}: listed`,
							await settled(() => api.reader.reader.listed(path, prototype, ["inherited", "unruled", "hello"])),
							{
								same: false,
								stable: true,
								keys: ["inherited", "hello", "bye"],
								ownKeys: ["inherited", "hello", "bye"],
								forIn: ["inherited", "hello", "bye"],
								viewForIn: ["inherited", "hello", "bye"],
								spread: ["inherited", "hello", "bye"],
								json: '{"inherited":5}',
								has: [true, true, true],
								described: [true, false, true]
							}
						],
						[`${path}: a write through it`, await settled(() => api.reader.reader.write(path, "written", 1)), "LOOSE_SET_NOT_OWNED"]
					);
				}
				checks.push(["another module's change", await settled(() => api.reader.reader.change("grp")), "LOOSE_SET_NOT_OWNED"]);
				checks.push(["leaves the node as it was", Object.getPrototypeOf(api.grp) === Function.prototype, true]);
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	}
];
