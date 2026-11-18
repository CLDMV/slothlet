/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scope-full-isolation-root-members.test.vitest.mjs
 *	@Date: 2026-11-18T12:43:34-08:00 (1795034614)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T12:47:28-08:00 (1795034848)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full-isolation run's (`run()`, `scope({ isolation: "full" })`) changes to the framework's root
 * functions through `self` stay in the run, as every other change it makes does.
 *
 * @description
 * The host's own code and module code assign, define and delete properties on `self.shutdown`, `self.destroy`, the
 * default routine's root cascade `self.initialize`, and `self.slothlet.shutdown`, inside a full scope and inside `run()`.
 * Each change gets the answer the same change gets where it reaches the instance (a partial scope for the host, a call
 * outside any flow for module code). A change that goes through is read back by the run, the instance's functions are
 * unchanged afterwards, as a plain-JS copy is unchanged by writes to the copy, and what the run kept stays readable once
 * the run has a tree of its own. Calling `self.shutdown()` / `self.destroy()` from the run behaves as the same call made
 * in a partial scope.
 *
 * Fixture (written at run time): `writer.mjs` makes each change through `self` and reads it back; `extra/extra.mjs` is
 * added inside the run to give it a tree of its own.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

const ROOT = path.join(process.cwd(), "tmp", "scope-full-isolation-root-members");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

/**
 * The members changed, each as the path below `self`.
 * @type {string[]}
 */
const MEMBERS = ["shutdown", "destroy", "initialize", "slothlet.shutdown"];

/**
 * Make each change on a member and read it back: assign a new key, define a new key, delete the function's own `name`.
 * Written into the module fixture by its source, so module code and the host's code run the same statements.
 * @param {object} s - `self`.
 * @param {string} member - The member's path below `self`.
 * @param {string} value - The value written.
 * @returns {object[]} Per change, `"ok"` and what the code reads back, or the error code.
 */
function changeAll(s, member, value) {
	const at = () => member.split(".").reduce((node, key) => node[key], s);
	const attempt = (change, read) => {
		try {
			change();
			return { outcome: "ok", seen: read() };
		} catch (error) {
			return { outcome: error?.code ?? error?.name ?? String(error) };
		}
	};
	return [
		attempt(
			() => {
				at().rootMark = value;
			},
			() => at().rootMark
		),
		attempt(
			() => {
				Object.defineProperty(at(), "rootDefined", { value, writable: true, enumerable: false, configurable: true });
			},
			() => [at().rootDefined, Object.getOwnPropertyDescriptor(at(), "rootDefined")?.enumerable]
		),
		attempt(
			() => {
				if (!delete at().name) throw new TypeError("delete refused");
			},
			() => [at().name, Object.hasOwn(at(), "name"), "name" in at()]
		)
	];
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "writer.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			`const changeAll = ${changeAll.toString()};`,
			"export function attempt(member, value) {",
			"\treturn changeAll(self, member, value);",
			"}",
			"export async function call(name) {",
			"\ttry {",
			'\t\treturn { outcome: "ok", value: await self[name]() };',
			"\t} catch (error) {",
			"\t\treturn { outcome: error?.code ?? String(error) };",
			"\t}",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(path.join(EXTRA, "extra.mjs"), "export function ping() {\n\treturn 1;\n}\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const runtime of ["async", "live"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["on", "off", "disabled", "omitted"]) CONFIGS.push({ runtime, mode, permissions });
	}
}

/**
 * Build an instance for a configuration.
 * @param {{runtime: string, mode: string, permissions: string}} config - The configuration.
 * @returns {Promise<object>} The api.
 */
function make({ runtime, mode, permissions }) {
	const perms =
		permissions === "omitted"
			? {}
			: permissions === "disabled"
				? { permissions: { mode: "disabled" } }
				: { permissions: { mode: permissions, policy: "allow", rules: [] } };
	return slothlet({ base: BASE, runtime, mode, silent: true, ...perms });
}

/**
 * The full-isolation flows.
 * @type {Record<string, function(object, Function): Promise<*>>}
 */
const FLOWS = {
	fullScope: (api, fn) => api.slothlet.context.scope({ context: { user: "root" }, isolation: "full", fn }),
	run: (api, fn) => api.slothlet.context.run({ user: "root" }, fn)
};

/**
 * A partial scope, where `self` is the instance's own.
 * @param {object} api - The api.
 * @param {Function} fn - The work.
 * @returns {Promise<*>} What it returns.
 */
const partial = (api, fn) => api.slothlet.context.scope({ context: { user: "root" }, isolation: "partial", fn });

/**
 * The member at a path below the api.
 * @param {object} api - The api.
 * @param {string} member - The path.
 * @returns {Function} The member.
 */
const memberOf = (api, member) => member.split(".").reduce((node, key) => node[key], api);

/**
 * The instance's members themselves.
 * @param {object} api - The api.
 * @returns {Function[]} The members, in the order of `MEMBERS`.
 */
const membersOf = (api) => MEMBERS.map((member) => memberOf(api, member));

/**
 * What the instance's members show for the properties the changes touch.
 * @param {object} api - The api.
 * @returns {object} The snapshot.
 */
const snapshot = (api) => {
	const shown = { members: membersOf(api) };
	for (const member of MEMBERS) {
		const fn = memberOf(api, member);
		shown[member] = {
			rootMark: fn.rootMark,
			rootDefined: Object.getOwnPropertyDescriptor(fn, "rootDefined"),
			name: Object.getOwnPropertyDescriptor(fn, "name")
		};
	}
	return shown;
};

/**
 * Assert the instance's members are the same functions, showing what they showed before.
 * @param {object} api - The api.
 * @param {object} before - The snapshot taken before.
 * @returns {void}
 */
const expectUnchanged = (api, before) => {
	const now = snapshot(api);
	for (let index = 0; index < MEMBERS.length; index++) expect(now.members[index]).toBe(before.members[index]);
	for (const member of MEMBERS) expect(now[member]).toEqual(before[member]);
};

describe.each(CONFIGS)(
	"Context > full isolation keeps changes to self's root functions in the run ($runtime, $mode, permissions $permissions)",
	(config) => {
		let api;
		let reference;

		afterEach(async () => {
			// An instance a test destroyed has no namespace left to shut down.
			await api?.slothlet?.shutdown().catch(() => {});
			await reference?.slothlet?.shutdown().catch(() => {});
			api = null;
			reference = null;
		});

		describe.each(MEMBERS)("%s", (member) => {
			it.each(Object.keys(FLOWS))(
				"the host's own code inside %s: same answers as where it reaches the instance, kept in the run",
				async (flowName) => {
					reference = await make(config);
					const expected = await partial(reference, () => changeAll(self, member, "ref"));

					api = await make(config);
					const before = snapshot(api);
					const inside = await FLOWS[flowName](api, () => changeAll(self, member, `host:${flowName}`));
					expect(inside.map((change) => change.outcome)).toEqual(expected.map((change) => change.outcome));
					if (inside[0].outcome === "ok") expect(inside[0].seen).toBe(`host:${flowName}`);
					if (inside[1].outcome === "ok") expect(inside[1].seen).toEqual([`host:${flowName}`, false]);
					if (inside[2].outcome === "ok") expect(inside[2].seen).toEqual(expected[2].seen);
					expectUnchanged(api, before);
				}
			);

			it.each(Object.keys(FLOWS))("module code inside %s: same answers as outside any flow, kept in the run", async (flowName) => {
				reference = await make(config);
				const expected = await reference.writer.attempt(member, "ref");

				api = await make(config);
				const before = snapshot(api);
				const inside = await FLOWS[flowName](api, () => api.writer.attempt(member, `module:${flowName}`));
				expect(inside.map((change) => change.outcome)).toEqual(expected.map((change) => change.outcome));
				if (inside[0].outcome === "ok") expect(inside[0].seen).toBe(`module:${flowName}`);
				if (inside[1].outcome === "ok") expect(inside[1].seen).toEqual([`module:${flowName}`, false]);
				if (inside[2].outcome === "ok") expect(inside[2].seen).toEqual(expected[2].seen);
				expectUnchanged(api, before);
			});
		});

		// The default routine's root cascade is rebuilt by every add, at the instance as in a run, so only the members that
		// an add keeps carry the run's change into its own tree.
		describe.each(["shutdown", "destroy", "slothlet.shutdown"])("%s, once the run has a tree of its own", (member) => {
			it.each(Object.keys(FLOWS))("inside %s: the run still reads its change, the instance never does", async (flowName) => {
				api = await make(config);
				const before = snapshot(api);
				const seen = await FLOWS[flowName](api, async () => {
					memberOf(self, member).rootMark = "before-add";
					await self.slothlet.api.add("extra", EXTRA);
					const carried = memberOf(self, member).rootMark;
					memberOf(self, member).rootMark = "after-add";
					return [carried, memberOf(self, member).rootMark];
				});
				expect(seen).toEqual(["before-add", "after-add"]);
				expectUnchanged(api, before);
				expect("extra" in api).toBe(false);
			});
		});

		describe.each(["shutdown", "destroy"])("calling self.%s() from the run", (name) => {
			it.each(Object.keys(FLOWS))("the host's own code inside %s: as the same call in a partial scope", async (flowName) => {
				reference = await make(config);
				const callIn = async (target, flow) => {
					let outcome;
					try {
						outcome = { outcome: "ok", value: await flow(target, () => self[name]()) };
					} catch (error) {
						outcome = { outcome: error?.code ?? String(error) };
					}
					let after;
					try {
						after = { outcome: "ok", value: typeof (await target.writer.attempt("shutdown", "after")) };
					} catch (error) {
						after = { outcome: error?.code ?? String(error) };
					}
					return { outcome, after };
				};
				const expected = await callIn(reference, partial);
				api = await make(config);
				expect(await callIn(api, FLOWS[flowName])).toEqual(expected);
			});

			it.each(Object.keys(FLOWS))("module code inside %s: as the same call in a partial scope", async (flowName) => {
				reference = await make(config);
				const expected = await partial(reference, () => reference.writer.call(name));
				api = await make(config);
				expect(await FLOWS[flowName](api, () => api.writer.call(name))).toEqual(expected);
			});
		});
	}
);
