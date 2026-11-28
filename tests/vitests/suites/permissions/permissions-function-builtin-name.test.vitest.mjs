/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-function-builtin-name.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:27-08:00 (1795869147)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function's own `name` and `length` read without a permission check, as plain JS reads them.
 *
 * @description
 * Consoles and formatters (`console.log`, `util.inspect`, a browser test runner's console) read the `name` and `length`
 * of every function they show. With the permission system on, a module reads them for every function it holds through
 * `self`, whatever the rules say about the function: the api root, a function node at a folder, a file, a mount or
 * deeper, a function held in a module's data, and slothlet's own functions under `self.slothlet`. The value is the one
 * the host reads, by a dot read, `Reflect.get` and the member's own descriptor alike. A member a module itself provides
 * by that name (a callable folder's `name.mjs` or `length.mjs`) is the module's data and is held to the rules like any
 * other member, a named `name` or `length` export beside a default function included (T29). Eager and lazy, async and
 * live, `"precise"` and `"fast"` attribution.
 * @module tests/vitests/suites/permissions/permissions-function-builtin-name
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = new URL("../../../../api_tests/api_test_function_builtin_names/", import.meta.url);
const DIR = fileURLToPath(new URL("base", FIXTURE));
const MOUNT = fileURLToPath(new URL("mount", FIXTURE));
const CALLABLE = fileURLToPath(new URL("callable", FIXTURE));

/** Every function target the module reads, by its path under `self` (`""` is the api root). */
const FUNCTIONS = [
	"",
	"math.add",
	"math.helpers.twice",
	"deep.inner.walk",
	"named",
	"mnt.gear.spin",
	"cm",
	"cm.helper",
	"slothlet.hook.on",
	"slothlet.api.add"
];

/** The api targets `probe` is refused by the deny-rule policy. */
const DENIED_TARGETS = ["math.**", "deep.**", "named.**", "mnt.**", "cm", "cm.**"];

/**
 * The permission setups. `denies` names whether the module's own `named.name` and `named.length` members are refused,
 * `unheld` the functions the module may not read at all (so it holds no function to read the members of), and `listed`
 * the members of `self.slothlet` the module lists.
 * @type {Array<{label: string, permissions: object, denies: boolean, unheld: string[], listed: string[]}>}
 */
const POLICIES = [
	{
		label: "a deny rule on each target",
		permissions: { policy: "allow", rules: DENIED_TARGETS.map((target) => ({ caller: "probe.**", target, effect: "deny" })) },
		denies: true,
		unheld: [],
		listed: ["slothlet", "slothlet.pin", "slothlet.hook", "slothlet.api"]
	},
	{
		label: "default deny with no rule for the target",
		permissions: { policy: "deny", rules: [] },
		denies: true,
		unheld: ["slothlet.api.add"],
		// `slothlet.api` is not the module's to read at all, so it is not listed here.
		listed: ["slothlet", "slothlet.pin", "slothlet.hook"]
	},
	{
		label: "default allow with no rule",
		permissions: { policy: "allow", rules: [] },
		denies: false,
		unheld: [],
		listed: ["slothlet", "slothlet.pin", "slothlet.hook", "slothlet.api"]
	}
];

/**
 * Whether a probe's answer is a refusal.
 * @param {*} answer - The answer.
 * @returns {boolean} True for `"THROW …"`.
 */
const threw = (answer) => typeof answer === "string" && answer.startsWith("THROW");

/** What every route answers when reading the function itself is refused. */
const UNHELD = {
	held: "THROW PERMISSION_DENIED",
	dot: "THROW PERMISSION_DENIED",
	reflect: "THROW PERMISSION_DENIED",
	descriptor: "THROW PERMISSION_DENIED"
};

/**
 * The member of the api at a dotted path, or the api itself.
 * @param {object} api - The api.
 * @param {string} where - The path.
 * @returns {*} The member.
 */
const at = (api, where) => (where === "" ? api : where.split(".").reduce((node, key) => node[key], api));

/**
 * What the host reads of a function's member, by the three routes the module uses.
 * @param {object} api - The api.
 * @param {string} where - The function's path.
 * @param {string} key - `name` or `length`.
 * @returns {{held: string, dot: *, reflect: *, descriptor: *}} The function's type and the three answers.
 */
const hostRead = (api, where, key) => ({
	held: typeof at(api, where),
	dot: at(api, where)[key],
	reflect: Reflect.get(at(api, where), key),
	descriptor: Reflect.getOwnPropertyDescriptor(at(api, where), key)?.value
});

/**
 * The host's walk of every function under a member, as the module's `formatted` walks it.
 * @param {object} api - The api.
 * @param {string} where - The member's path.
 * @param {number} depth - How deep to walk.
 * @returns {Map<string, string>} `"<name>/<length>"` per function path.
 */
const hostWalk = (api, where, depth) => {
	const out = new Map();
	const walk = (value, here, left) => {
		if (typeof value === "function") out.set(here, `${value.name}/${value.length}`);
		if (left === 0 || value === null || (typeof value !== "object" && typeof value !== "function")) return;
		for (const key of Object.keys(value)) walk(value[key], here === "" ? key : `${here}.${key}`, left - 1);
	};
	walk(at(api, where), where, depth);
	return out;
};

/** Each config of the matrix under each attribution. */
const CONFIGS = getMatrixConfigs().flatMap(({ name, config }) =>
	["precise", "fast"].map((attribution) => ({ name: `${name} ${attribution}`, config, attribution }))
);

describe.each(CONFIGS)("Permissions > a function's built-in name and length > $name", ({ config, attribution }) => {
	describe.each(POLICIES)("$label", ({ permissions, denies, unheld, listed }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ ...config, base: DIR, silent: true, permissions: { ...permissions, caller: { attribution } } });
			await api.slothlet.api.add(["mnt"], MOUNT);
			// A folder whose root file's default export is a function: a callable mount holding the folder's other members.
			await api.slothlet.api.add(["cm"], CALLABLE);
			// Load every node, so a lazy instance answers as a loaded one (the host's answers are the expected values).
			await api.math;
			await api.deep.inner;
			await api.named;
			await api.mnt.gear;
			await api.cm;
			await api.probe;
		});

		afterAll(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Run one of `probe`'s functions in the module.
		 * @param {string} fn - The function.
		 * @param {...*} args - Its arguments.
		 * @returns {Promise<*>} What it returned.
		 */
		const probe = (fn, ...args) => withSuppressedSlothletErrorOutput(() => api.probe[fn](...args));

		it.each(FUNCTIONS.filter((where) => where !== "named"))("a module reads the name and length of %j as the host does", async (where) => {
			for (const key of ["name", "length"]) {
				const expected = hostRead(api, where, key);
				// Plain JS: a function's own descriptor holds what reading the member gives.
				expect(expected.descriptor, `${where}.${key} descriptor`).toBe(expected.dot);
				// A module's `self` takes the api root's form (#803), so over a callable root it reads as the host's api does.
				expect(await probe("read", where, key), `${where}.${key}`).toEqual(unheld.includes(where) ? UNHELD : expected);
			}
		});

		it("a module reads the callable folder's built-in name and length only where it provides none", async () => {
			// `named` provides both itself: the host reads the module's data.
			expect(hostRead(api, "named", "name")).toEqual({
				held: "function",
				dot: "custom-name",
				reflect: "custom-name",
				descriptor: "custom-name"
			});
			expect(hostRead(api, "named", "length")).toEqual({ held: "function", dot: 99, reflect: 99, descriptor: 99 });
		});

		it("holds a module's own name and length members to the rules", async () => {
			const refused = { held: "function", dot: "THROW PERMISSION_DENIED", reflect: "THROW PERMISSION_DENIED", descriptor: undefined };
			expect(await probe("read", "named", "name")).toEqual(
				denies ? refused : { held: "function", dot: "custom-name", reflect: "custom-name", descriptor: "custom-name" }
			);
			expect(await probe("read", "named", "length")).toEqual(denies ? refused : { held: "function", dot: 99, reflect: 99, descriptor: 99 });
		});

		it("lets a module walk self as a formatter does, reading each function's name and length as the host does", async () => {
			const walked = await probe("formatted", "", 4);
			const host = hostWalk(api, "", 4);
			const failed = walked.filter((entry) => entry.includes("THROW"));
			// Only the callable folder whose `name` and `length` are the module's own data is refused, and only where the rules refuse it.
			expect(failed).toEqual(denies ? ["named THROW PERMISSION_DENIED"] : []);
			for (const entry of walked.filter((line) => !line.includes("THROW"))) {
				// A function's name may hold a space (`bound on`); the path never does.
				const where = entry.slice(0, entry.indexOf(" "));
				expect(entry.slice(where.length + 1), where).toBe(host.get(where));
			}
			for (const where of ["math.add", "deep.inner.walk", "mnt.gear.spin", "cm", "cm.helper"]) {
				expect(walked, where).toContain(`${where} ${host.get(where)}`);
			}
		});

		it("lets a module list members of self.slothlet as the members it may read, members named like a function's own ones included", async () => {
			for (const where of listed) {
				const keys = await probe("listed", where);
				expect(Array.isArray(keys), `${where}: ${keys}`).toBe(true);
				for (const key of keys) expect(threw((await probe("read", where, key)).dot), `${where}.${key}`).toBe(false);
				// What the module may read is listed: the host lists every member, and each one the module reads is among the module's.
				for (const key of Object.keys(at(api, where))) {
					if (!threw((await probe("read", where, key)).dot)) expect(keys, `${where}.${key}`).toContain(key);
				}
			}
		});

		it("lets a module util.inspect and console.log self and its nodes without an error", async () => {
			const log = vi.spyOn(console, "log").mockImplementation(() => {});
			try {
				for (const where of ["", "math", "math.add", "deep", "mnt", "slothlet", "slothlet.hook"]) {
					expect(await probe("inspected", where), where).not.toMatch(/^THROW/);
					expect(await probe("logged", where), where).toBe("logged");
				}
			} finally {
				log.mockRestore();
			}
		});
	});

	it("lets a module read name and length of nodes it has not loaded, under default deny", async () => {
		const api = await slothlet({ ...config, base: DIR, silent: true, permissions: { policy: "deny", caller: { attribution } } });
		try {
			await api.probe;
			for (const where of ["math.add", "deep.inner.walk", "math.helpers.twice"]) {
				const { dot, reflect } = await withSuppressedSlothletErrorOutput(() => api.probe.read(where, "name"));
				expect(typeof dot, `${where} ${dot}`).toBe("string");
				expect(dot, where).not.toMatch(/^THROW/);
				expect(reflect, where).toBe(dot);
				const length = await withSuppressedSlothletErrorOutput(() => api.probe.read(where, "length"));
				expect(typeof length.dot, `${where} ${length.dot}`).toBe("number");
			}
		} finally {
			await api.shutdown();
		}
	});
});

describe.each(CONFIGS)(
	"Permissions > a named name and length export beside a default function (T29) > $name",
	({ config, attribution }) => {
		const EXPORTED = fileURLToPath(new URL("exported", FIXTURE));

		it.each(POLICIES)("is the module's data, held to the rules: $label", async ({ permissions, denies }) => {
			const rules = permissions.rules.map((rule) => (rule.target === "mnt.**" ? { ...rule, target: "ext.**" } : rule));
			const api = await slothlet({ ...config, base: DIR, silent: true, permissions: { ...permissions, rules, caller: { attribution } } });
			try {
				await api.slothlet.api.add(["ext"], EXPORTED);
				await api.ext.calc;
				await api.probe;
				expect(hostRead(api, "ext.calc", "name")).toEqual({
					held: "function",
					dot: "custom-name",
					reflect: "custom-name",
					descriptor: "custom-name"
				});
				expect(hostRead(api, "ext.calc", "length")).toEqual({ held: "function", dot: 7, reflect: 7, descriptor: 7 });
				const refused = { held: "function", dot: "THROW PERMISSION_DENIED", reflect: "THROW PERMISSION_DENIED", descriptor: undefined };
				const read = (key) => withSuppressedSlothletErrorOutput(() => api.probe.read("ext.calc", key));
				expect(await read("name")).toEqual(
					denies ? refused : { held: "function", dot: "custom-name", reflect: "custom-name", descriptor: "custom-name" }
				);
				expect(await read("length")).toEqual(denies ? refused : { held: "function", dot: 7, reflect: 7, descriptor: 7 });
			} finally {
				await api.shutdown();
			}
		});
	}
);

describe.each(CONFIGS)(
	"Permissions > listing a function a module may not read the prototype of (#812) > $name",
	({ config, attribution }) => {
		/** Default deny, without rules and with rules that leave every `prototype` refused. */
		const DENIES = [
			{ label: "default deny with no rule", rules: [] },
			{
				label: "default deny with rules for other paths",
				rules: [
					{ caller: "probe.**", target: "math.**", effect: "allow" },
					{ caller: "probe.**", target: "slothlet.pin.caller", effect: "allow" }
				]
			}
		];

		it.each(DENIES)("lists the function and withholds its prototype: $label", async ({ rules }) => {
			const api = await slothlet({ ...config, base: DIR, silent: true, permissions: { policy: "deny", rules, caller: { attribution } } });
			try {
				await api.slothlet.api.add(["cm"], CALLABLE);
				await api.math;
				await api.cm;
				await api.probe;
				const run = (fn, ...args) => withSuppressedSlothletErrorOutput(() => api.probe[fn](...args));
				for (const where of ["slothlet.pin", "slothlet.hook.on", "math.add", "cm", ""]) {
					const keys = await run("listed", where);
					expect(Array.isArray(keys), `${where}: ${keys}`).toBe(true);
					// Every key listed reads without a refusal, or is a function's own `prototype`, whose read stays refused.
					for (const key of keys) expect(threw((await run("read", where, key)).dot), `${where}.${key}`).toBe(false);
				}
				// The namespace function's own `prototype` is still refused, and its description withholds the value.
				for (const where of ["slothlet.pin", "slothlet.hook.on"]) {
					const { dot, reflect, descriptor } = await run("read", where, "prototype");
					expect(dot, where).toBe("THROW PERMISSION_DENIED");
					expect(reflect, where).toBe("THROW PERMISSION_DENIED");
					expect(descriptor, where).toBeUndefined();
				}
			} finally {
				await api.shutdown();
			}
		});
	}
);
