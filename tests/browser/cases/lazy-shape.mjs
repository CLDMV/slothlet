/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/lazy-shape.mjs
 *	@Date: 2026-11-15T12:31:32-08:00 (1794774692)
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
 * @fileoverview Rows: what a lazy folder's members answer before and after the folder loads.
 *
 * @description
 * - A member read before its folder loads (a stand-in) answers as the member once the folder has loaded: a Map is a
 *   Map, an object lists its keys, a string reads as the string (#776), and its `__type` is the member's kind (#791).
 * - A folder that has not loaded is listed as the folder it is, whatever the rules on its path say (#790).
 * - A folder that loaded as a namespace lists no function `length` or `name` (#794).
 *
 * The expected answers are the plain value's (imported plainly), or the eager instance's in the same environment
 * where a module reads through `self`. Lazy mode, the async and live runtime, both attributions, and the permission
 * system off and disabled.
 * @module tests/browser/cases/lazy-shape
 */

import { matrix, answer, settled } from "../helpers/rows.mjs";

const HELD = "api_tests/api_test_lazy_held_standin";
const HELD_FILES = [
	"d/arr.mjs",
	"d/date.mjs",
	"d/err.mjs",
	"d/fn.mjs",
	"d/map.mjs",
	"d/num.mjs",
	"d/obj.mjs",
	"d/set.mjs",
	"d/str.mjs",
	"reader.mjs"
];
const KEYS = ["map", "set", "date", "err", "arr", "obj", "fn", "str", "num"];

const LISTING = "api_tests/api_test_lazy_unloaded_listing";
const LISTING_FILES = [
	"folder/a.mjs",
	"folder/b.mjs",
	"outer/file.mjs",
	"outer/inner/a.mjs",
	"outer/inner/b.mjs",
	"outer/pdata.mjs",
	"reader.mjs"
];

/** The lazy configs with the permission system on, then off and disabled. */
const lazyConfigs = [
	...matrix({ modes: ["lazy"] }).map((config) => ({
		...config,
		permissions: { policy: "allow", caller: { attribution: config.attribution } }
	})),
	...["off", "disabled"].map((mode) => ({
		mode: "lazy",
		runtime: "async",
		permissions: { mode },
		name: `lazy / async / permissions ${mode}`
	}))
];

/** The lazy configs with the permission system on. */
const lazyOn = lazyConfigs.filter((config) => config.attribution);

/**
 * The questions the fixture's `reader.ask` asks, asked of a value.
 * @param {*} node - The value, its node, or a member kept from before its folder loaded.
 * @returns {object} The answers.
 */
function ask(node) {
	return {
		proto: answer(() => {
			const proto = Object.getPrototypeOf(node);
			return proto === null ? null : proto.constructor.name;
		}),
		map: answer(() => node instanceof Map),
		set: answer(() => node instanceof Set),
		date: answer(() => node instanceof Date),
		error: answer(() => node instanceof Error),
		array: answer(() => node instanceof Array),
		keys: answer(() => Object.keys(node)),
		has: answer(() => "a" in Object(node)),
		value: answer(() => {
			if (node instanceof Map) return [node.get("k"), node.size, [...node]];
			if (node instanceof Set) return [node.has("s"), node.size, [...node]];
			if (node instanceof Date) return node.getTime();
			if (node instanceof Error) return node.message;
			if (node instanceof Array) return [node[0], node.length, [...node]];
			const proto = Object.getPrototypeOf(Object(node));
			if (proto === String.prototype || proto === Number.prototype) return [`${node}`, node.length];
			if (proto === Function.prototype) return [node.name, node.length];
			return [node.a, node.b, node.f()];
		})
	};
}

/**
 * Every answer refused, as a read of the member is.
 * @returns {object} The answers.
 */
function refused() {
	const threw = { threw: "PERMISSION_DENIED" };
	return { proto: threw, map: threw, set: threw, date: threw, error: threw, array: threw, keys: threw, has: threw, value: threw };
}

/**
 * What the reader module is answered about a member on an eager instance with the same permission settings, where the
 * member is the loaded node from the start: every answer refused when its read is refused.
 * @param {object} env - The environment.
 * @param {object} config - The row's config.
 * @param {string} key - The member.
 * @param {object[]} [rules=[]] - Permission rules.
 * @returns {Promise<object>} The answers.
 */
async function eagerAsk(env, config, key, rules = []) {
	const api = await env.compose({
		fixture: HELD,
		files: HELD_FILES,
		options: { mode: "eager", runtime: config.runtime, permissions: { ...config.permissions, rules } }
	});
	try {
		const taken = await settled(() => api.reader.take(key));
		return taken === true ? await api.reader.ask(key) : refused();
	} finally {
		await api.shutdown();
	}
}

/**
 * The reader's listings of the root and `outer`.
 * @param {object} api - The api.
 * @returns {Promise<object>} The listings.
 */
async function listings(api) {
	return {
		root: await api.reader.list("", ["folder", "outer", "reader", "nope"]),
		outer: await api.reader.list("outer", ["inner", "pdata", "file", "nope"])
	};
}

/**
 * The host's and the reader's own keys of `d` or of one of its members.
 * @param {object} api - The api.
 * @param {string} [key] - The member; none for `d`.
 * @returns {Promise<object>} The listings.
 */
async function ownKeys(api, key) {
	const node = key ? api.d[key] : api.d;
	const describe = (prop) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(node, prop);
		return descriptor && { value: descriptor.value, enumerable: descriptor.enumerable };
	};
	return {
		host: { keys: Reflect.ownKeys(node).map(String), length: describe("length"), name: describe("name") },
		module: await api.reader.own(key)
	};
}

/** The rules a listing row runs under. */
const MEMBERS = ["folder", "outer.inner", "outer.pdata", "outer.file"];
const RULE_SETS = {
	"an exact deny": MEMBERS.map((target) => ({ caller: "reader.**", target, effect: "deny" })),
	"a deny on everything beneath": MEMBERS.map((target) => ({ caller: "reader.**", target: `${target}.**`, effect: "deny" }))
};

export const rows = [
	{
		title: "a member kept from before its folder loads answers the host as the value once loaded (#776)",
		configs: lazyConfigs,
		async run(env, config) {
			const api = await env.compose({
				fixture: HELD,
				files: HELD_FILES,
				options: { mode: "lazy", runtime: config.runtime, permissions: config.permissions }
			});
			try {
				const kept = Object.fromEntries(KEYS.map((key) => [key, api.d[key]]));
				await api.d;
				const checks = [];
				for (const key of KEYS) {
					const expected = ask((await env.plain(HELD, `d/${key}.mjs`)).default);
					checks.push([`kept ${key}`, ask(kept[key]), expected], [`fresh ${key}`, ask(api.d[key]), expected]);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "a member a module kept through self answers as the eager node does once loaded, and stays refused under a deny (#776)",
		configs: lazyOn,
		async run(env, config) {
			const checks = [];
			for (const key of ["map", "obj", "str"]) {
				const expected = await eagerAsk(env, config, key);
				const api = await env.compose({
					fixture: HELD,
					files: HELD_FILES,
					options: { mode: "lazy", runtime: config.runtime, permissions: config.permissions }
				});
				try {
					await api.reader.take(key);
					await api.reader.settle();
					checks.push([`module kept ${key}`, await api.reader.ask(key), expected]);
				} finally {
					await api.shutdown();
				}
				const rules = [{ caller: "reader.**", target: `d.${key}`, effect: "deny" }];
				const denied = await env.compose({
					fixture: HELD,
					files: HELD_FILES,
					options: { mode: "lazy", runtime: config.runtime, permissions: { ...config.permissions, rules } }
				});
				try {
					await denied.reader.take(key);
					await denied.reader.settle();
					checks.push([`denied kept ${key}`, await denied.reader.ask(key), await eagerAsk(env, config, key, rules)]);
				} finally {
					await denied.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a kept member's __type is the kind of what it reads as once its folder has loaded (#791)",
		configs: lazyConfigs,
		async run(env, config) {
			const api = await env.compose({
				fixture: HELD,
				files: HELD_FILES,
				options: { mode: "lazy", runtime: config.runtime, permissions: config.permissions }
			});
			try {
				const kept = Object.fromEntries(KEYS.map((key) => [key, api.d[key]]));
				const checks = KEYS.map((key) => [`${key} before the load`, kept[key].__type === api.slothlet.types.IN_FLIGHT, true]);
				await api.d;
				for (const key of KEYS) {
					const value = (await env.plain(HELD, `d/${key}.mjs`)).default;
					checks.push([`${key} once loaded`, kept[key].__type, typeof value === "object" && value !== null ? "object" : typeof value]);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "a folder not loaded yet is listed as it is once loaded, whatever the rules on its path say (#790)",
		configs: lazyOn,
		async run(env, config) {
			const checks = [];
			for (const [name, rules] of Object.entries(RULE_SETS)) {
				const options = { runtime: config.runtime, permissions: { ...config.permissions, rules } };
				const eager = await env.compose({ fixture: LISTING, files: LISTING_FILES, options: { ...options, mode: "eager" } });
				const expected = await listings(eager);
				await eager.shutdown();
				const api = await env.compose({ fixture: LISTING, files: LISTING_FILES, options: { ...options, mode: "lazy" } });
				try {
					await api.outer;
					checks.push([`${name}: folders not loaded`, [api.folder.__materialized, api.outer.inner.__materialized], [false, false]]);
					checks.push([`${name}: before the load`, await listings(api), expected]);
					await api.folder;
					await api.outer.inner;
					checks.push([`${name}: after the load`, await listings(api), expected]);
				} finally {
					await api.shutdown();
				}
			}
			return checks;
		}
	},
	{
		title: "a lazy folder that loaded as a namespace lists the eager node's own keys, with no function length or name (#794)",
		configs: lazyConfigs,
		async run(env, config) {
			const options = { runtime: config.runtime, permissions: config.permissions };
			const eager = await env.compose({ fixture: HELD, files: HELD_FILES, options: { ...options, mode: "eager" } });
			const expected = {};
			for (const key of ["", "fn", "obj"]) expected[key] = await ownKeys(eager, key || undefined);
			await eager.shutdown();
			const api = await env.compose({ fixture: HELD, files: HELD_FILES, options: { ...options, mode: "lazy" } });
			try {
				await api.d;
				const checks = [];
				for (const key of ["", "fn", "obj"])
					checks.push([`own keys of d${key ? "." + key : ""}`, await settled(() => ownKeys(api, key || undefined)), expected[key]]);
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	}
];
