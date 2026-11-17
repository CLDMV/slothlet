/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/null-default.mjs
 *	@Date: 2026-11-15T12:32:08-08:00 (1794774728)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:03-08:00 (1794882483)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a file whose default export is `null` or `undefined` reads as that value at every node, and a
 * module the rules deny it is refused it (#792).
 *
 * @description
 * The fixture's folder is the api root and is mounted again at `zz`. The expected values are the files' own default
 * exports, imported plainly. Eager and lazy mode, the async and live runtime, both attributions, and the permission
 * system off and disabled.
 * @module tests/browser/cases/null-default
 */

import { matrix, settled } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_null_default";
const FILES = [
	"folder/blank.mjs",
	"folder/inner.mjs",
	"folder/num.mjs",
	"folder/other.mjs",
	"nnamed.mjs",
	"pnull.mjs",
	"pnum.mjs",
	"pundef.mjs",
	"reader.mjs",
	"selfnull/selfnull.mjs",
	"selfundef/selfundef.mjs"
];

/** Each node holding a file's null or undefined default, with the file, and the same at the `zz` mount. */
const EVERY = [
	["pnull", "pnull.mjs"],
	["pundef", "pundef.mjs"],
	["folder.inner", "folder/inner.mjs"],
	["folder.blank", "folder/blank.mjs"],
	["selfnull", "selfnull/selfnull.mjs"],
	["selfundef", "selfundef/selfundef.mjs"]
].flatMap(([path, file]) => [
	[path, file],
	[`zz.${path}`, file]
]);

/** A primitive default beside each node's parent, for the listing a denied module is given. */
const BESIDE = { "": "pnum", folder: "folder.num", zz: "zz.pnum", "zz.folder": "zz.folder.num" };

const configs = [
	...matrix().map((config) => ({ ...config, permissions: { caller: { attribution: config.attribution }, rules: [] } })),
	...["eager", "lazy"].flatMap((mode) =>
		["off", "disabled"].map((permissionsMode) => ({
			mode,
			runtime: "async",
			permissions: { mode: permissionsMode },
			name: `${mode} / async / permissions ${permissionsMode}`
		}))
	)
];

/**
 * The node at a dotted path.
 * @param {object} root - Where to start.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (root, path) => path.split(".").reduce((node, key) => node[key], root);

/**
 * A path's parent and last segment.
 * @param {string} path - The path.
 * @returns {[string, string]} The parent (empty for the root) and the member's name.
 */
function split(path) {
	const index = path.lastIndexOf(".");
	return index === -1 ? ["", path] : [path.slice(0, index), path.slice(index + 1)];
}

/**
 * A value as the fixture's reader describes it.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value !== "object") return typeof value === "function" ? { function: true } : value;
	return { object: true };
}

/**
 * Build an instance over the fixture with the same folder mounted again at `zz`, every node loaded.
 * @param {object} env - The environment.
 * @param {object} config - The row's config.
 * @param {object} [permissions] - Permission settings over the config's.
 * @returns {Promise<object>} The api.
 */
async function build(env, config, permissions = {}) {
	const api = await env.compose({
		fixture: FIXTURE,
		files: FILES,
		options: { mode: config.mode, runtime: config.runtime, permissions: { ...config.permissions, ...permissions } }
	});
	await api.slothlet.api.add("zz", env.mountTarget(api, { from: "", files: FILES }), { moduleID: "zz" });
	for (const [path] of EVERY) await at(api, path);
	for (const path of Object.values(BESIDE)) await at(api, path);
	await api.reader;
	return api;
}

export const rows = [
	{
		title: "reads, awaits and is described as the plain module's default export, by the host and a module",
		configs,
		async run(env, config) {
			const api = await build(env, config);
			try {
				const checks = [];
				for (const [path, file] of EVERY) {
					const plain = described((await env.plain(FIXTURE, file)).default);
					const [parent, name] = split(path);
					const holder = parent ? at(api, parent) : api;
					checks.push(
						[`the host reads ${path}`, described(at(api, path)), plain],
						[`the host awaits ${path}`, described(await at(api, path)), plain],
						[`${path} is listed and in its parent`, [Object.keys(holder).includes(name), name in holder], [true, true]],
						[`${path} is described by its value`, described(Object.getOwnPropertyDescriptor(holder, name)?.value), plain],
						[`a module reads ${path}`, await settled(() => api.reader.read(path)), plain],
						[`a module awaits ${path}`, await settled(() => api.reader.settle(path)), plain],
						[`a module lists ${path}`, await settled(() => api.reader.member(parent, name)), { keys: true, has: true, described: plain }]
					);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "a module the rules deny is refused the read and the await and is not given it in a listing; the host reads it",
		configs: configs.filter((config) => config.attribution),
		async run(env, config) {
			const rules = [...EVERY.map(([path]) => path), ...Object.values(BESIDE)].map((target) => ({
				caller: "reader.**",
				target,
				effect: "deny"
			}));
			const api = await build(env, config, { rules });
			try {
				const checks = [];
				for (const [path, file] of EVERY) {
					const [parent, name] = split(path);
					const listed = await settled(() => api.reader.member(parent, name));
					checks.push(
						[`the reader reads ${path}`, await settled(() => api.reader.read(path)), { threw: "PERMISSION_DENIED" }],
						[`the reader awaits ${path}`, await settled(() => api.reader.settle(path)), { threw: "PERMISSION_DENIED" }],
						[`the reader lists ${path}`, listed, { keys: false, has: true, described: { none: true } }],
						[
							`the reader lists ${path} as ${BESIDE[parent]}`,
							await settled(() => api.reader.member(parent, split(BESIDE[parent])[1])),
							listed
						],
						[`the host reads ${path}`, described(at(api, path)), described((await env.plain(FIXTURE, file)).default)]
					);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "an in-memory add of a null or undefined default reads as the value, and one with named exports keeps them",
		configs,
		async run(env, config) {
			const api = await build(env, config);
			try {
				await api.slothlet.api.add("mnull", { default: null });
				await api.slothlet.api.add("mundef", { default: undefined });
				await api.slothlet.api.add("mboth", { default: null, x: 1 });
				return [
					["mnull", described(api.mnull), null],
					["mundef", described(api.mundef), { undefined: true }],
					["mboth keys", Object.keys(api.mboth).sort(), ["default", "x"]],
					["mboth.default", api.mboth.default, null],
					["mboth.x", api.mboth.x, 1]
				];
			} finally {
				await api.shutdown();
			}
		}
	}
];
