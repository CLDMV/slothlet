/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/node-prototype.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:39:38-08:00 (1794778778)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a prototype given to a function node or a namespace slothlet composed is reported and inherited
 * from as on a plain value, and what the node inherits is read under the rules its own members are (#802).
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
	shown.closed = [
		Object.getPrototypeOf(value) === prototype,
		value.inherited,
		Reflect.setPrototypeOf(value, {}),
		Reflect.setPrototypeOf(value, prototype)
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
		options: { mode: config.mode, runtime: config.runtime, permissions: { attribution: config.attribution, ...permissions } }
	});
	await api.slothlet.api.add("reader", env.mountTarget(api, { from: "reader", files: ["reader.mjs"] }), { moduleID: "reader" });
	for (const path of ["leaf", "leaf.only", "grp", "sub", "sub.lay", "sub.other", "reader", "reader.reader"]) await at(api, path);
	return api;
}

export const rows = [
	{
		title: "a node takes, reports, inherits from and closes with a prototype as its plain twin does",
		configs: matrix(),
		async run(env, config) {
			const checks = [];
			for (const [path, plain] of NODES) {
				const api = await build(env, config, { defaultPolicy: "allow" });
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
				{ caller: "reader.reader.call", target: `${path}.hello`, effect: "allow" }
			]);
			const api = await build(env, config, { defaultPolicy: "deny", rules });
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
							{ has: true, own: false, same: true }
						]
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
