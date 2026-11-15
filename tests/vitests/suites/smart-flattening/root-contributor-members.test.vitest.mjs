/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/root-contributor-members.test.vitest.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The members of a root file whose default export is a function (the file the api root calls) are nodes
 * at the paths they are reached at: loaded as the base folder they answer as the same folder mounted with
 * `api.slothlet.api.add()` does.
 *
 * @description
 * Fixture `api_test_root_contributor_members`: `calc.mjs` (default `calc`, named `add`, `peek`, `me` and an object
 * `cfg` with `f`), `vault.mjs` (`get`) and `probe.mjs` (`call(target, ...args)`, a module that calls a node and returns
 * its result or the error's code). Loaded as the base folder, `api()` is `calc` and `api.add` is the named export; mounted
 * at `zz`, the same nodes are `api.zz()` and `api.zz.add`. Expected values are the paths the nodes are reached at, the
 * plain call results, and what the rules say: a deny on a node's path refuses it, a deny naming a node as the caller
 * refuses that node's access. The caller rows run at the base load only: at a mount the members of such a file record
 * the mounted folder as their file, a separate item.
 *
 * Also the two existing root shapes that hold such a file: `smart_flatten/api_smart_flatten_fn_fn_folder` (a root
 * `calc.mjs` beside `calc/calc.mjs`) and `api_test` (`root-function.mjs`).
 * @module tests/vitests/suites/smart-flattening/root-contributor-members
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const API_TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");
const FIXTURE = path.join(API_TESTS, "api_test_root_contributor_members");
const WORK = path.join(API_TESTS, "api_test_globstar_zero", "work");

const MODES = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => [mode, runtime]));
const ATTRIBUTIONS = ["precise", "fast"];
/** Where the fixture is placed: "" is the base load, "zz" a mount. */
const PLACES = ["", "zz"];

/**
 * The node at a dotted path.
 * @param {object} root - Where the path starts.
 * @param {string} at - The path.
 * @returns {unknown} The node.
 */
const nodeAt = (root, at) => at.split(".").reduce((node, key) => node[key], root);

/**
 * Builds the fixture at `place`.
 * @param {string} place - "" for the base load, or the mount path.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build(place, options) {
	const api = await slothlet({ base: place ? WORK : FIXTURE, silent: true, ...options });
	if (place) await api.slothlet.api.add(place, FIXTURE);
	return api;
}

describe.each(MODES)("a root file's members are nodes at the paths they are reached at > %s, %s", (mode, runtime) => {
	describe.each(PLACES)("placed at '%s'", (place) => {
		const P = place ? `${place}.` : "";

		it("each member records the path it is reached at, and metadata answers for that path", async () => {
			const api = await build(place, { mode, runtime, diagnostics: true });
			try {
				expect(await nodeAt(api, `${P}add`)(2, 3)).toBe(5);
				expect(await nodeAt(api, `${P}cfg.f`)()).toBe("cfg.f");
				for (const name of ["add", "peek", "me", "cfg", "cfg.f"]) {
					expect([name, nodeAt(api, `${P}${name}`).__metadata?.apiPath]).toEqual([name, `${P}${name}`]);
				}
				expect((await api.slothlet.metadata.get(`${P}add`))?.apiPath).toBe(`${P}add`);
				expect(await nodeAt(api, `${P}me`)()).toBe(`${P}me`);
				expect(await nodeAt(api, `${P}probe.call`)(`${P}me`)).toBe(`${P}me`);
				expect(api.slothlet.diag.owner.get(`${P}add`)?.size).toBe(1);
				expect(api.slothlet.diag.owner.get(`${P}cfg.f`)?.size).toBe(1);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a hook on a member's path fires once per call and reports that path", async () => {
			const api = await build(place, { mode, runtime, hook: true });
			try {
				const fired = [];
				api.slothlet.hook.on(`${P}add:before`, ({ path: at }) => {
					fired.push(at);
				});
				api.slothlet.hook.on(`${P}cfg.**:before`, ({ path: at }) => {
					fired.push(at);
				});
				expect(await nodeAt(api, `${P}add`)(2, 3)).toBe(5);
				expect(await nodeAt(api, `${P}cfg.f`)()).toBe("cfg.f");
				expect(fired).toEqual([`${P}add`, `${P}cfg.f`]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		describe.each(ATTRIBUTIONS)("permissions, %s attribution", (attribution) => {
			const options = (rules) => ({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules } });

			it("a deny on a member's path refuses that member and nothing beside it", async () => {
				const denyAdd = await build(place, options([{ caller: `${P}probe.**`, target: `${P}add`, effect: "deny" }]));
				try {
					expect(await nodeAt(denyAdd, `${P}probe.call`)(`${P}add`, 2, 3)).toBe("PERMISSION_DENIED");
					expect(await nodeAt(denyAdd, `${P}probe.call`)(`${P}cfg.f`)).toBe("cfg.f");
				} finally {
					await denyAdd.slothlet.shutdown();
				}
				const denyCfg = await build(place, options([{ caller: `${P}probe.**`, target: `${P}cfg.**`, effect: "deny" }]));
				try {
					expect(await nodeAt(denyCfg, `${P}probe.call`)(`${P}add`, 2, 3)).toBe(5);
					expect(await nodeAt(denyCfg, `${P}probe.call`)(`${P}cfg.f`)).toBe("PERMISSION_DENIED");
				} finally {
					await denyCfg.slothlet.shutdown();
				}
			});
		});
	});

	describe.each(ATTRIBUTIONS)("loaded as the base folder, %s attribution", (attribution) => {
		const options = (rules) => ({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules } });

		it("a deny naming a member as the caller refuses that member's access, whoever calls it", async () => {
			const api = await build("", options([{ caller: "peek", target: "vault.**", effect: "deny" }]));
			try {
				await expect(api.peek("")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
				expect(await api.probe.call("peek", "")).toBe("PERMISSION_DENIED");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a member's access a rule does not name is allowed", async () => {
			const api = await build("", options([{ caller: "probe", target: "vault.**", effect: "deny" }]));
			try {
				expect(await api.peek("")).toBe("SECRET");
				expect(await api.probe.call("peek", "")).toBe("SECRET");
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	it("the existing root shapes: a root file's named export records the path it is reached at and a hook on it fires", async () => {
		for (const [fixture, name, args, result] of [
			["smart_flatten/api_smart_flatten_fn_fn_folder", "add", [2, 3], 5],
			["api_test", "rootFunctionShout", ["x"], "HELLO, X!"]
		]) {
			const api = await slothlet({ base: path.join(API_TESTS, fixture), mode, runtime, silent: true, hook: true });
			try {
				const fired = [];
				api.slothlet.hook.on(`${name}:before`, ({ path: at }) => {
					fired.push(at);
				});
				expect(await api[name](...args)).toBe(result);
				expect([fixture, api[name].__metadata?.apiPath, fired]).toEqual([fixture, name, [name]]);
			} finally {
				await api.slothlet.shutdown();
			}
		}
	});
});

/**
 * Builds a fixture at `place`.
 * @param {string} fixture - The fixture folder under `api_tests`.
 * @param {string} place - "" for the base load, or the mount path.
 * @param {object} options - Instance options.
 * @returns {Promise<{api: object, root: object}>} The api and the node the fixture's root is.
 */
async function buildAt(fixture, place, options) {
	const dir = path.join(API_TESTS, fixture);
	const api = await slothlet({ base: place ? WORK : dir, silent: true, ...options });
	if (place) await api.slothlet.api.add(place, dir);
	return { api, root: place ? nodeAt(api, place) : api };
}

describe.each(MODES)("a root file's members of every kind answer as plain JavaScript > %s, %s", (mode, runtime) => {
	describe.each(PLACES)("placed at '%s'", (place) => {
		const P = place ? `${place}.` : "";

		it("functions, a class, objects and arrays are nodes at their paths; data values and primitives stay values", async () => {
			const { api, root } = await buildAt("api_test_root_contributor_kinds", place, { mode, runtime });
			try {
				expect(root()).toBe("main");
				for (const name of ["add", "later", "Klass", "cfg", "cfg.f", "cfg.nested", "cfg.nested.g", "inst", "arr", "launch"]) {
					expect([name, nodeAt(root, name).__metadata?.apiPath]).toEqual([name, `${P}${name}`]);
				}
				expect(await root.add(2, 3)).toBe(5);
				expect(await root.later(4)).toBe(8);
				expect(await root.cfg.f()).toBe("cfg.f");
				expect(await root.cfg.nested.g()).toBe("g");
				expect(root.cfg.n).toBe(1);
				const made = new root.Klass(4);
				expect([made instanceof root.Klass, made.double, made.v]).toEqual([true, 8, 4]);
				const fromFactory = await root.Klass.make(3);
				expect([fromFactory instanceof root.Klass, fromFactory.v]).toEqual([true, 3]);
				expect([root.inst instanceof root.Klass, root.inst.double, Object.getPrototypeOf(root.inst) === root.Klass.prototype]).toEqual([
					true,
					10,
					true
				]);
				expect([root.arr.length, root.arr[0], root.arr[1], Array.isArray(root.arr)]).toEqual([2, 1, 2, true]);
				expect([root.map instanceof Map, root.map.get("a"), root.map.__metadata]).toEqual([true, 1, undefined]);
				expect([root.date instanceof Date, root.date.getTime()]).toEqual([true, 0]);
				expect([root.err instanceof Error, root.err.message]).toEqual([true, "boom"]);
				expect(root.num).toBe(3);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a CommonJS export's own members: a function and an object are nodes, an accessor stays an accessor", async () => {
			const { api, root } = await buildAt("api_test_root_contributor_cjs", place, { mode, runtime, hook: true });
			try {
				expect(root()).toBe("main");
				expect(root.helper.__metadata?.apiPath).toBe(`${P}helper`);
				expect(root.cfg.f.__metadata?.apiPath).toBe(`${P}cfg.f`);
				const fired = [];
				api.slothlet.hook.on(`${P}helper:before`, ({ path: at }) => {
					fired.push(at);
				});
				expect(await root.helper()).toBe("helper");
				expect(await root.cfg.f()).toBe("cfg.f");
				expect(fired).toEqual([`${P}helper`]);
				expect(root.live).toBe(1);
				expect(await root.setLive(5)).toBe(5);
				expect(root.live).toBe(5);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a routine a root file's member provides runs once from the root cascade, and once more where it is placed", async () => {
			globalThis.__rootKindsLaunches = 0;
			const { api, root } = await buildAt("api_test_root_contributor_kinds", place, { mode, runtime, routines: ["launch"] });
			try {
				// The root cascade is `api.launch`; at the base load the member is placed there too.
				await api.launch();
				expect(globalThis.__rootKindsLaunches).toBe(1);
				if (place) {
					expect(await root.launch()).toBe("launched");
					expect(globalThis.__rootKindsLaunches).toBe(2);
				}
			} finally {
				await api.slothlet.shutdown();
				delete globalThis.__rootKindsLaunches;
			}
		});

		it("a member is removed by its path, comes back on reload, and a mount onto it adds to it", async () => {
			const { api, root } = await buildAt("api_test_root_contributor_members", place, { mode, runtime, diagnostics: true });
			try {
				await api.slothlet.api.add(`${P}cfg.extra`, path.join(API_TESTS, "api_test_root_contributor_kinds"));
				expect(await root.cfg.extra.add(1, 2)).toBe(3);
				expect(root.cfg.extra.add.__metadata?.apiPath).toBe(`${P}cfg.extra.add`);
				expect(await root.cfg.f()).toBe("cfg.f");
				await api.slothlet.api.remove(`${P}cfg.extra`);
				expect(root.cfg.extra).toBe(undefined);
				expect(await root.cfg.f()).toBe("cfg.f");
				await api.slothlet.reload();
				const reloaded = place ? nodeAt(api, place) : api;
				expect(await reloaded.add(2, 3)).toBe(5);
				expect(reloaded.add.__metadata?.apiPath).toBe(`${P}add`);
				expect(api.slothlet.diag.owner.get(`${P}add`)?.size).toBe(1);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("writes by module code onto a member answer as they do on any node, in every permission mode", async () => {
			for (const permissions of [undefined, { defaultPolicy: "allow" }, "disabled"]) {
				const { api, root } = await buildAt("api_test_root_contributor_members", place, {
					mode,
					runtime,
					...(permissions ? { permissions } : {})
				});
				try {
					expect([permissions, await root.probe.write(`${P}cfg.n`, 7), root.cfg.n]).toEqual([permissions, "WRITTEN", 7]);
					expect([permissions, await root.probe.write(`${P}fresh`, 1)]).toEqual([permissions, "WRITTEN"]);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		});

		it.each(ATTRIBUTIONS)("permissions disabled check nothing on a member, %s attribution", async (attribution) => {
			const { api, root } = await buildAt("api_test_root_contributor_members", place, {
				mode,
				runtime,
				permissions: { mode: "disabled", attribution, rules: [{ caller: "**", target: `${P}add`, effect: "deny" }] }
			});
			try {
				expect(await root.probe.call(`${P}add`, 2, 3)).toBe(5);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	it("the callable root itself is called as before and is not a node of its own", async () => {
		const { api } = await buildAt("api_test_root_contributor_members", "", { mode, runtime, hook: true });
		try {
			const fired = [];
			api.slothlet.hook.on("**:before", ({ path: at }) => {
				fired.push(at);
			});
			expect(api(3, 4)).toBe(12);
			expect(typeof api).toBe("function");
			expect(api.__metadata?.apiPath).toBe(undefined);
			expect(fired).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
