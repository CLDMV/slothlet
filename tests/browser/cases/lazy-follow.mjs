/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/lazy-follow.mjs
 *	@Date: 2026-11-15T12:32:39-08:00 (1794774759)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:02-08:00 (1794882482)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a self-named folder below the root whose file exports a primitive by default (#795), a module's
 * read of a node's `__type` (#796), and a lazy folder node kept before it loaded as a primitive (#797).
 *
 * @description
 * - `zz/num/num.mjs` with `export default 42` loads in both modes and reads as 42; a module reads it through `self`
 *   and is refused it under a deny on its path. The expected value is the file's default export imported plainly.
 * - A module reading `self.d.fn.__type` is answered as the host is, and refused only under a deny on the node's path.
 *   The expected type is the host's answer on an eager instance in the same environment.
 * - A node kept before its lazy folder loaded as a primitive answers as the value once loaded (await, coercion,
 *   `__type`), and a module the rules deny the node is refused every answer.
 * Eager and lazy mode, the async and live runtime, both attributions; the permission system off and disabled for the
 * kept node.
 * @module tests/browser/cases/lazy-follow
 */

import { matrix, settled } from "../helpers/rows.mjs";

const NESTED = "api_tests/api_test_nested_primitive_folder";
const NESTED_FILES = [
	"reader.mjs",
	"top/top.mjs",
	"zz/big/big.mjs",
	"zz/bool/bool.mjs",
	"zz/nul/nul.mjs",
	"zz/num/num.mjs",
	"zz/str/str.mjs",
	"zz/sym/sym.mjs",
	"zz/und/und.mjs",
	"zz/yy/deep/deep.mjs"
];
const NESTED_MEMBERS = {
	"zz.num": "zz/num/num.mjs",
	"zz.str": "zz/str/str.mjs",
	"zz.bool": "zz/bool/bool.mjs",
	"zz.big": "zz/big/big.mjs",
	"zz.sym": "zz/sym/sym.mjs",
	"zz.yy.deep": "zz/yy/deep/deep.mjs",
	"zz.nul": "zz/nul/nul.mjs",
	"zz.und": "zz/und/und.mjs",
	top: "top/top.mjs"
};

const TYPE_READ = "api_tests/api_test_node_type_read";
const TYPE_READ_FILES = ["reader.mjs", "d/data.mjs", "d/fn.mjs", "d/sub/leaf.mjs"];
const TYPE_PATHS = ["d", "d.fn", "d.data", "d.sub", "d.sub.leaf"];

const KEPT = "api_tests/api_test_kept_primitive_folder";
const KEPT_FILES = [
	"reader.mjs",
	"zz/marker.mjs",
	"zz/big/big.mjs",
	"zz/bool/bool.mjs",
	"zz/num/num.mjs",
	"zz/str/str.mjs",
	"zz/sym/sym.mjs"
];
const KEPT_KEYS = ["num", "str", "bool", "big", "sym"];

/**
 * The node at a dotted path.
 * @param {object} root - Where to start.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (root, path) => path.split(".").reduce((node, key) => node[key], root);

/**
 * A value as the nested fixture's reader reports it.
 * @param {*} value - The value.
 * @returns {{kind: string, value: *}} The report.
 */
const kindReport = (value) => ({
	kind: typeof value,
	value: typeof value === "symbol" ? value.description : typeof value === "bigint" ? `${value}n` : value
});

/**
 * A value as the kept fixture's reader reports it.
 * @param {*} value - The value.
 * @returns {*} The report.
 */
const report = (value) => {
	if (typeof value === "symbol") return { symbol: value.description };
	if (typeof value === "bigint") return { bigint: String(value) };
	if (value !== null && (typeof value === "object" || typeof value === "function")) return { node: true };
	return value;
};

/**
 * The reader's answers less `__type`, which a plain value does not have.
 * @param {object} answers - The answers.
 * @returns {object} The answers without `type`.
 */
const withoutType = ({ type: ___type, ...rest }) => rest;

/**
 * Permission settings for a config.
 * @param {object} config - The row's config.
 * @param {object[]} [rules=[]] - Rules.
 * @returns {object} The settings.
 */
const permissionsOf = (config, rules = []) => config.permissions ?? { caller: { attribution: config.attribution }, policy: "allow", rules };

const keptConfigs = [
	...matrix(),
	...["off", "disabled"].map((mode) => ({
		mode: "lazy",
		runtime: "async",
		permissions: { mode },
		name: `lazy / async / permissions ${mode}`
	}))
];

export const rows = [
	{
		title: "a self-named folder below the root whose file's default export is a primitive reads as the value (#795)",
		configs: matrix(),
		async run(env, config) {
			const checks = [];
			const api = await settled(() =>
				env.compose({
					fixture: NESTED,
					files: NESTED_FILES,
					options: { mode: config.mode, runtime: config.runtime, permissions: permissionsOf(config) }
				})
			);
			if (api?.threw) return [["the instance loads", api, "loaded"]];
			try {
				for (const [path, file] of Object.entries(NESTED_MEMBERS)) {
					const plain = (await env.plain(NESTED, file)).default;
					await at(api, path);
					checks.push(
						[`the host reads ${path}`, kindReport(at(api, path)), kindReport(plain)],
						[`a module reads ${path}`, await settled(() => api.reader.read(path)), kindReport(plain)]
					);
				}
			} finally {
				await api.shutdown();
			}
			for (const path of ["zz.num", "zz.sym", "zz.yy.deep"]) {
				const denied = await env.compose({
					fixture: NESTED,
					files: NESTED_FILES,
					options: {
						mode: config.mode,
						runtime: config.runtime,
						permissions: permissionsOf(config, [{ caller: "reader.**", target: path, effect: "deny" }])
					}
				});
				try {
					checks.push([`a module denied ${path}`, await settled(() => denied.reader.read(path)), { threw: "PERMISSION_DENIED" }]);
					await at(denied, path);
					checks.push([
						`the host reads ${path} beside the deny`,
						kindReport(at(denied, path)),
						kindReport((await env.plain(NESTED, NESTED_MEMBERS[path])).default)
					]);
				} finally {
					await denied.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a module's read of a node's __type is answered as the host's, and refused only under a deny on the node (#796)",
		configs: matrix(),
		async run(env, config) {
			const options = (permissions = {}) => ({
				mode: config.mode,
				runtime: config.runtime,
				permissions: { caller: { attribution: config.attribution }, policy: "allow", rules: [], ...permissions }
			});
			const loadAll = async (api) => {
				for (const path of TYPE_PATHS) await at(api, path);
			};
			const eager = await env.compose({ fixture: TYPE_READ, files: TYPE_READ_FILES, options: { mode: "eager" } });
			const expected = Object.fromEntries(TYPE_PATHS.map((path) => [path, at(eager, path).__type]));
			await eager.shutdown();
			const checks = [];
			const open = await env.compose({ fixture: TYPE_READ, files: TYPE_READ_FILES, options: options() });
			try {
				await loadAll(open);
				for (const path of TYPE_PATHS) checks.push([`no rules: ${path}`, await settled(() => open.reader.type(path)), expected[path]]);
			} finally {
				await open.shutdown();
			}
			for (const path of ["d.fn", "d.sub"]) {
				const denied = await env.compose({
					fixture: TYPE_READ,
					files: TYPE_READ_FILES,
					options: options({ rules: [{ caller: "reader.**", target: path, effect: "deny" }] })
				});
				try {
					await loadAll(denied);
					checks.push([`deny on ${path}`, await settled(() => denied.reader.type(path)), { threw: "PERMISSION_DENIED" }]);
					checks.push([`the host beside the deny on ${path}`, at(denied, path).__type, expected[path]]);
				} finally {
					await denied.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a lazy folder node kept before it loaded as a primitive answers as the value once loaded (#797)",
		configs: keptConfigs,
		async run(env, config) {
			const { answersOf } = await env.plain(KEPT, "reader.mjs");
			const api = await env.compose({
				fixture: KEPT,
				files: KEPT_FILES,
				options: { mode: config.mode, runtime: config.runtime, permissions: permissionsOf(config) }
			});
			try {
				await api.zz;
				const checks = [];
				for (const key of KEPT_KEYS) {
					const plain = (await env.plain(KEPT, `zz/${key}/${key}.mjs`)).default;
					const kept = api.zz[key];
					checks.push([`the host awaits its kept ${key}`, report(await kept), report(plain)]);
					checks.push([`the host's kept ${key} answers`, withoutType(answersOf(kept)), withoutType(answersOf(plain))]);
					checks.push([`the host's kept ${key} __type`, kept.__type, config.mode === "lazy" ? typeof plain : undefined]);
				}
				for (const key of KEPT_KEYS) {
					const plain = (await env.plain(KEPT, `zz/${key}/${key}.mjs`)).default;
					checks.push([`a module takes ${key}`, await settled(() => api.reader.take(key)), true]);
					checks.push([`a module awaits its kept ${key}`, await settled(() => api.reader.settle(key)), report(plain)]);
					const answers = await settled(() => api.reader.answers(key));
					checks.push([`a module's kept ${key} answers`, withoutType(answers), withoutType(answersOf(plain))]);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "a module the rules deny a kept lazy folder node is refused every answer, before and after the load (#797)",
		configs: matrix({ modes: ["lazy"] }),
		async run(env, config) {
			const checks = [];
			for (const key of ["num", "sym"]) {
				const api = await env.compose({
					fixture: KEPT,
					files: KEPT_FILES,
					options: {
						mode: "lazy",
						runtime: config.runtime,
						permissions: permissionsOf(config, [{ caller: "reader.**", target: `zz.${key}`, effect: "deny" }])
					}
				});
				try {
					await api.zz;
					checks.push([`a module takes ${key}`, await settled(() => api.reader.take(key)), true]);
					checks.push([`a module awaits its kept ${key}`, await settled(() => api.reader.settle(key)), { threw: "PERMISSION_DENIED" }]);
					await api.zz[key];
					const answers = await settled(() => api.reader.answers(key));
					checks.push([
						`every answer about ${key} is refused`,
						Object.values(answers).every((value) => value?.threw === "PERMISSION_DENIED"),
						true
					]);
				} finally {
					await api.shutdown();
				}
			}
			return checks;
		}
	}
];
