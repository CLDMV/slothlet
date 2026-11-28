/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/cases/function-default-members.mjs
 *	@Date: 2026-11-15T12:30:53-08:00 (1794774653)
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
 * @fileoverview Rows: a default function's named exports called `name`, `length`, `prototype` or like the function
 * itself are its members, and a function node lists its keys in a function's order.
 *
 * @description
 * The expected values are the fixture files' own exports, imported plainly, and the keys a plain function with the
 * same members lists. Eager and lazy mode, the async and live runtime, both attributions.
 * @module tests/browser/cases/function-default-members
 */

import { matrix, answer, settled } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_browser_fn_members";

const FILES = [
	"math/calc.mjs",
	"math/other.mjs",
	"shape/proto.mjs",
	"shape/other.mjs",
	"solo/solo.mjs",
	"klass/klass.mjs",
	"klass/side.mjs",
	"own/own.mjs",
	"own/side.mjs",
	"later/af.mjs",
	"later/other.mjs",
	"reader/reader.mjs"
];

/** The keys a function lists first, in its own order. */
const FUNCTION_KEYS = Reflect.ownKeys(function twin() {}).map(String);

/**
 * The keys a function holding `node`'s members lists, in a function's order.
 * @param {Function} node - The api node.
 * @returns {string[]} `length`, `name`, `prototype` (when it has one), then its other members.
 */
function functionOrder(node) {
	const first = FUNCTION_KEYS.filter((key) => key !== "prototype" || Reflect.getOwnPropertyDescriptor(node, "prototype"));
	return [...first, ...Object.keys(node).filter((key) => !FUNCTION_KEYS.includes(key))];
}

/**
 * Build the instance and load the nodes the rows read.
 * @param {object} env - The environment.
 * @param {object} config - The row's config.
 * @param {object[]} [rules=[]] - Permission rules.
 * @returns {Promise<object>} The api.
 */
async function build(env, { mode, runtime, attribution }, rules = []) {
	const api = await env.compose({
		fixture: FIXTURE,
		files: FILES,
		options: {
			mode,
			runtime,
			api: { collision: { mode: { initial: "merge", api: "merge" } } },
			permissions: { policy: "allow", caller: { attribution }, rules }
		}
	});
	for (const key of ["math", "shape", "solo", "klass", "own", "later", "reader"]) await api[key];
	for (const node of [api.math.calc, api.shape.proto, api.later.af]) await node;
	return api;
}

/**
 * The plain modules.
 * @param {object} env - The environment.
 * @returns {Promise<Record<string, object>>} Each file's namespace.
 */
async function plain(env) {
	const out = {};
	for (const file of ["math/calc.mjs", "shape/proto.mjs", "solo/solo.mjs", "klass/klass.mjs", "own/own.mjs"]) {
		out[file] = await env.plain(FIXTURE, file);
	}
	return out;
}

const configs = matrix();

export const rows = [
	{
		title: "reads a named export called name, length or prototype beside a default function as the member",
		configs,
		async run(env, config) {
			const ns = await plain(env);
			const api = await build(env, config);
			try {
				const calc = ns["math/calc.mjs"];
				const proto = ns["shape/proto.mjs"];
				const klass = ns["klass/klass.mjs"];
				return [
					["calc()", api.math.calc(2, 3), calc.default(2, 3)],
					["calc.name", answer(() => api.math.calc.name), calc.name],
					["calc.length", answer(() => api.math.calc.length), calc.length],
					["calc.helper()", answer(() => api.math.calc.helper()), calc.helper()],
					["proto.prototype", answer(() => api.shape.proto.prototype), proto.prototype],
					["proto.tag", answer(() => api.shape.proto.tag), proto.tag],
					["klass.prototype", answer(() => api.klass.prototype), klass.prototype],
					["klass.name", answer(() => api.klass.name), klass.name],
					["new klass().v", answer(() => new api.klass().v), new klass.default().v],
					// A member the module put on its function itself still wins under merge.
					["own.tag", answer(() => api.own.tag), ns["own/own.mjs"].default.tag]
				];
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "keeps a named export called like the default function as a member, and a self-named file's default as the folder's",
		configs,
		async run(env, config) {
			const ns = await plain(env);
			const api = await build(env, config);
			try {
				const calc = ns["math/calc.mjs"];
				const solo = ns["solo/solo.mjs"];
				return [
					["calc()", api.math.calc(4, 5), calc.default(4, 5)],
					["calc.calc()", answer(() => api.math.calc.calc()), calc.calc()],
					["solo()", answer(() => api.solo(2, 3)), solo.default(2, 3)],
					["solo.solo()", answer(() => api.solo.solo()), solo.solo()],
					["solo.name", answer(() => api.solo.name), solo.name]
				];
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "lists a function node's keys in a function's order",
		configs,
		async run(env, config) {
			const api = await build(env, config);
			try {
				const checks = [];
				for (const [label, node] of [
					["math.calc", api.math.calc],
					["shape.proto", api.shape.proto],
					["solo", api.solo],
					["klass", api.klass],
					["own", api.own]
				]) {
					checks.push([label, Reflect.ownKeys(node).map(String), functionOrder(node)]);
				}
				// An async function has no prototype, as in plain JavaScript.
				const af = async function af() {};
				af.extra = 1;
				checks.push(["later.af", Reflect.ownKeys(api.later.af).map(String), Reflect.ownKeys(af).map(String)]);
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "holds a member called name to its own path's rules, and lets a module read the member called like the function",
		configs,
		async run(env, config) {
			const calc = (await plain(env))["math/calc.mjs"];
			const api = await build(env, config, [{ caller: "reader.**", target: "math.calc.name", effect: "deny" }]);
			try {
				const listed = await settled(() => api.reader.listKeys());
				return [
					["host name", api.math.calc.name, calc.name],
					["module name", await settled(() => api.reader.readName()), { threw: "PERMISSION_DENIED" }],
					["module length", await settled(() => api.reader.readLength()), calc.length],
					["module calc()", await settled(() => api.reader.readCalc()), calc.calc()],
					["module lists name", Array.isArray(listed) && listed.includes("name"), false],
					["module lists length, helper, calc", ["length", "helper", "calc"].every((key) => listed.includes(key)), true]
				];
			} finally {
				await api.shutdown();
			}
		}
	}
];
