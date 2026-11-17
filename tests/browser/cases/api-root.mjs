/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/api-root.mjs
 *	@Date: 2026-11-15T12:33:18-08:00 (1794774798)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:15:57-08:00 (1794777357)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: changes to the api root (define, delete, close, set the prototype) are made on the api and held to
 * a node's write rules (#783), and deleting a member of a function node removes it (#800).
 *
 * @description
 * Each root (a folder of files, one whose root file's default export is a function, one whose is an async function)
 * is the api and is mounted again at `zz`, so the root has a twin one level down; a `writer` module mounted at `w` owns
 * neither. A module's change through the api the host handed it or `self.slothlet.diag.api()` answers at the root
 * as at the twin; closing the root is refused to it. The host's own changes answer as on a plain object. Eager and
 * lazy mode, the async and live runtime, both attributions, with and without write rules granting the members.
 * @module tests/browser/cases/api-root
 */

import { matrix, answer, settled } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_api_root_integrity";
const ROOT_FILES = { objroot: ["data.mjs", "pnum.mjs", "tool.mjs"], fnroot: ["data.mjs", "pnum.mjs", "root.mjs", "tool.mjs"] };
ROOT_FILES.asyncroot = ROOT_FILES.fnroot;

/** The changes the writer makes that the twin answers as the root must. */
const TWIN_CHANGES = ["set", "setSymbol", "define", "defineFixed", "delete"];

/** The changes that close a node. */
const CLOSING_CHANGES = ["freeze", "seal", "preventExtensions"];

/** The fixture's member names, and the ones a change adds. */
const NAMES = ["data", "pnum", "tool", "rnum", "wset", "wdef", "wfix"];

/** The members a write rule names. */
const WRITTEN = ["wset", "wdef", "wfix", "data"];

const PERMISSIONS = {
	"no write rule": (attribution) => ({ defaultPolicy: "allow", attribution, rules: [] }),
	"write rules granting each member": (attribution) => ({
		defaultPolicy: "allow",
		attribution,
		rules: ["", "zz."].flatMap((prefix) =>
			WRITTEN.map((member) => ({ caller: "w.**", target: `${prefix}${member}:write`, effect: "allow" }))
		)
	})
};

/**
 * Build an instance over a root, with the same folder mounted again at `zz` and the writer at `w`.
 * @param {object} env - The environment.
 * @param {string} root - The root's folder.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build(env, root, options) {
	const files = ROOT_FILES[root];
	const api = await env.compose({ fixture: FIXTURE, root, files, options: { diagnostics: true, ...options } });
	await api.slothlet.api.add("zz", env.mountTarget(api, { from: root, files }), { moduleID: "zz" });
	await api.slothlet.api.add("w", env.mountTarget(api, { from: "writer", files: ["ops.mjs"] }), { moduleID: "w" });
	for (const member of ["data", "pnum", "tool"]) {
		await api[member];
		await api.zz[member];
	}
	await api.w.ops;
	return api;
}

/**
 * The fixture's member names a node lists.
 * @param {object} node - The node.
 * @returns {string[]} The names, sorted.
 */
const listed = (node) =>
	Reflect.ownKeys(node)
		.filter((key) => NAMES.includes(key))
		.sort();

/** A row per root and permission setting. */
const configs = ["objroot", "fnroot", "asyncroot"].flatMap((root) =>
	Object.keys(PERMISSIONS).flatMap((setting) =>
		matrix().map((config) => ({ ...config, root, setting, name: `${root} / ${setting} / ${config.name}` }))
	)
);

/** A row per root, for the host's own changes. */
const hostConfigs = ["objroot", "fnroot", "asyncroot"].flatMap((root) =>
	matrix({ attributions: ["precise"] }).map((config) => ({ ...config, root, name: `${root} / ${config.name}` }))
);

export const rows = [
	{
		title: "a module's change through the api it was handed answers at the root as at its twin one level down",
		configs,
		async run(env, { mode, runtime, attribution, root, setting }) {
			const checks = [];
			for (const change of TWIN_CHANGES) {
				for (const via of ["given", "api"]) {
					const api = await build(env, root, { mode, runtime, permissions: PERMISSIONS[setting](attribution) });
					try {
						const twin = api.w.ops.change(change, via, "zz", api);
						const atRoot = api.w.ops.change(change, via, "", api);
						checks.push([`${change} through the ${via} api`, atRoot, twin]);
						checks.push([`${change} through the ${via} api: what the root holds`, listed(api), listed(api.zz)]);
						checks.push([`${change} through the ${via} api: extensible`, Object.isExtensible(api), Object.isExtensible(api.zz)]);
					} finally {
						await api.shutdown();
					}
				}
			}
			return checks;
		}
	},
	{
		title: "a module closing the root or assigning slothlet's root function is refused, and the root stays open",
		configs,
		async run(env, { mode, runtime, attribution, root, setting }) {
			const checks = [];
			for (const change of CLOSING_CHANGES) {
				const api = await build(env, root, { mode, runtime, permissions: PERMISSIONS[setting](attribution) });
				try {
					const twin = api.w.ops.change(change, "given", "zz", api);
					const atRoot = api.w.ops.change(change, "given", "", api);
					checks.push([`${change}`, atRoot, "threw" in twin ? twin : api.w.ops.change("setReserved", "self", "")]);
					checks.push([`${change}: the root stays open`, [Object.isExtensible(api), typeof api.shutdown], [true, "function"]]);
				} finally {
					await api.shutdown();
				}
			}
			const api = await build(env, root, { mode, runtime, permissions: PERMISSIONS[setting](attribution) });
			try {
				checks.push([
					"setReserved through the given api",
					api.w.ops.change("setReserved", "given", "", api),
					api.w.ops.change("setReserved", "self", "")
				]);
				const twin = api.w.ops.change("setPrototypeOf", "given", "zz", api);
				const atRoot = api.w.ops.change("setPrototypeOf", "given", "", api);
				const expected = "threw" in twin ? twin : root === "objroot" ? { same: true, inherited: 5 } : { threw: "TypeError" };
				checks.push(["setPrototypeOf through the given api", atRoot, expected]);
			} finally {
				await api.shutdown();
			}
			return checks;
		}
	},
	{
		title: "the host defines, freezes, seals and closes the root as an object, and a closed root refuses new members",
		configs: hostConfigs,
		async run(env, { mode, runtime, root }) {
			const checks = [];
			let api = await build(env, root, { mode, runtime });
			try {
				const plain = {};
				for (const target of [plain, api]) {
					Object.defineProperty(target, "wdef", { value: 2, writable: true, enumerable: true, configurable: true });
					Object.defineProperty(target, "wfix", { value: 3, writable: false, enumerable: false, configurable: false });
				}
				checks.push(["defined members", [api.wdef, api.wfix], [2, 3]]);
				checks.push([
					"listing",
					[Object.keys(api).includes("wdef"), Object.keys(api).includes("wfix"), Reflect.ownKeys(api).includes("wfix")],
					[true, false, true]
				]);
				checks.push(["wdef descriptor", Object.getOwnPropertyDescriptor(api, "wdef"), Object.getOwnPropertyDescriptor(plain, "wdef")]);
				checks.push(["wfix descriptor", Object.getOwnPropertyDescriptor(api, "wfix"), Object.getOwnPropertyDescriptor(plain, "wfix")]);
				checks.push(["delete", [delete api.wdef, "wdef" in api, Reflect.deleteProperty(api, "wfix")], [true, false, false]]);
			} finally {
				await api.shutdown();
			}

			api = await build(env, root, { mode, runtime });
			try {
				const data = api.data;
				Object.freeze(api);
				checks.push(["frozen", [Object.isFrozen(api), Object.isExtensible(api)], [true, false]]);
				checks.push(["reads after the freeze", [api.data === data, api.data.a, api.pnum, api.tool.run()], [true, 1, 7, "run"]]);
				checks.push([
					"nothing changes after the freeze",
					[Reflect.set(api, "wset", 1), Reflect.set(api, "data", 1), Reflect.deleteProperty(api, "data"), Reflect.setPrototypeOf(api, {})],
					[false, false, false, false]
				]);
				checks.push([
					"members and slothlet stay open",
					[Object.isFrozen(api.data), Object.isFrozen(api.slothlet), Object.isFrozen(Object.prototype)],
					[false, false, false]
				]);
				const added = await settled(() =>
					api.slothlet.api.add("extra", env.mountTarget(api, { from: `${root}/data.mjs` }), { moduleID: "extra" })
				);
				checks.push(["an add at the closed root", added, { threw: "API_ROOT_CLOSED" }]);
				checks.push(["a reload of the closed root", await settled(() => api.slothlet.reload()), { threw: "API_ROOT_CLOSED" }]);
			} finally {
				await api.shutdown();
			}

			api = await build(env, root, { mode, runtime });
			try {
				Object.seal(api);
				api.data = 5;
				checks.push([
					"sealed",
					[Object.isSealed(api), Object.isFrozen(api), api.data, Reflect.set(api, "wset", 1)],
					[true, false, 5, false]
				]);
			} finally {
				await api.shutdown();
			}

			api = await build(env, root, { mode, runtime });
			try {
				const prototype = { inherited: 5 };
				// An object root and a function root alike, as an object and a function take one.
				Object.setPrototypeOf(api, prototype);
				checks.push([
					"prototype",
					[Object.getPrototypeOf(api) === prototype, api.inherited, Object.keys(api).includes("inherited")],
					[true, 5, false]
				]);
			} finally {
				await api.shutdown();
			}
			return checks;
		}
	},
	{
		title: "deleting a member of a function node removes it, as from a function (#800)",
		configs: matrix({ attributions: ["precise"] }),
		async run(env, { mode, runtime }) {
			const fn = function root() {};
			fn.data = { a: 1 };
			const deleted = delete fn.data;
			const expected = { deleted, has: "data" in fn, listed: Object.keys(fn).includes("data"), read: typeof fn.data };
			const checks = [];
			for (const root of ["fnroot", "asyncroot"]) {
				const api = await env.compose({ fixture: FIXTURE, root: "objroot", files: ROOT_FILES.objroot, options: { mode, runtime } });
				try {
					await api.slothlet.api.add("zz", env.mountTarget(api, { from: root, files: ROOT_FILES[root] }), { moduleID: "zz" });
					await api.zz.data;
					checks.push([`${root}: a function node`, typeof api.zz, "function"]);
					const gone = delete api.zz.data;
					checks.push([
						`${root}: delete`,
						{ deleted: gone, has: "data" in api.zz, listed: Object.keys(api.zz).includes("data"), read: typeof api.zz.data },
						expected
					]);
					checks.push([`${root}: the other members stay`, [answer(() => api.zz.tool.run()), api.zz.pnum], ["run", 7]]);
				} finally {
					await api.shutdown();
				}
			}
			const api = await env.compose({ fixture: FIXTURE, root: "objroot", files: ROOT_FILES.objroot, options: { mode, runtime } });
			try {
				await api.slothlet.api.add("zz", env.mountTarget(api, { from: "fnroot", files: ROOT_FILES.fnroot }), { moduleID: "zz" });
				await api.slothlet.api.add("w", env.mountTarget(api, { from: "writer", files: ["ops.mjs"] }), { moduleID: "w" });
				await api.zz.data;
				await api.w.ops;
				checks.push(["a module deletes it", api.w.ops.change("delete", "given", "zz", api), { deleted: true, has: false }]);
				checks.push(["it is not listed", Object.keys(api.zz).includes("data"), false]);
			} finally {
				await api.shutdown();
			}
			return checks;
		}
	}
];
