/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-config.test.vitest.mjs
 *	@Date: 2026-11-16T16:18:22-08:00 (1794874702)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-19T16:10:35-08:00 (1795133435)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet-migrate: v3 slothlet() config objects (JavaScript literals and JSON files).
 * @module tests/vitests/suites/migrate/migrate-config.test.vitest
 */

import { describe, it, expect } from "vitest";
import { migrateJson, migrateSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

const IMPORT = 'import slothlet from "@cldmv/slothlet";\n';

/**
 * Migrate a snippet that calls slothlet().
 * @param {string} body - Code after the import line.
 * @param {object} [options] - migrateSource options.
 * @returns {{ code: string, findings: object[], ids: (level?: string) => string[] }} Result.
 */
function run(body, options = {}) {
	const res = migrateSource(IMPORT + body, { filename: "config.mjs", ...options });
	expect(res.error).toBeNull();
	return {
		...res,
		code: res.code.slice(IMPORT.length),
		ids: (level) => res.findings.filter((f) => !level || f.level === level).map((f) => f.entry)
	};
}

describe("slothlet-migrate: config renames and moves", () => {
	it("renames keys in place and moves keys into new groups", () => {
		const r = run(
			`await slothlet({ dir: "./api", apiDepth: 2, backgroundMaterialize: true, platform: "node", resolveModuleSpecifier: (s) => s });`
		);
		expect(r.code).toBe(`await slothlet({ base: "./api", depth: 2, loader: { materialize: true, platform: "node", resolve: (s) => s } });`);
		expect(r.ids("rewrite")).toEqual([
			"config|dir",
			"config|apiDepth",
			"config|backgroundMaterialize",
			"config|platform",
			"config|resolveModuleSpecifier"
		]);
	});

	it("moves permission options into the caller and gating groups", () => {
		const r = run(
			`await slothlet({ permissions: { defaultPolicy: "deny", readGating: true, typedArrayMembers: "strict", failOpenOnAbsentCaller: false, attribution: "fast", ceiling: "leaf", provenance: true, references: { capture: false }, events: { default: "notify" } } });`
		);
		expect(r.code).toBe(
			`await slothlet({ permissions: { policy: "deny", gating: { read: true, buffers: "strict" }, caller: { anonymous: false, attribution: "fast", ceiling: "leaf", provenance: true, capture: false }, events: { policy: "notify" } } });`
		);
		expect(r.ids("rewrite")).toContain("config|permissions.references");
		expect(r.ids("manual")).toEqual([]);
	});

	it("keeps formatting and comments of a multi-line literal", () => {
		const r = run(
			[
				"await slothlet({",
				"\t// where the api lives",
				'\tdir: "./api",',
				"\tautoRoutines: true,",
				'\troutines: ["start"],',
				"\t/* collisions */",
				'\tapi: { collision: "merge", mutations: { allowCollisionOverride: true } },',
				"\tscanHiddenFolders: true, // dot folders too",
				'\thook: { suppressErrors: true, pattern: "x" }',
				"});"
			].join("\n")
		);
		expect(r.code).toBe(
			[
				"await slothlet({",
				"\t// where the api lives",
				'\tbase: "./api",',
				"\troutines: {",
				"\t\tauto: true,",
				'\t\tentries: ["start"]',
				"\t},",
				"\t/* collisions */",
				'\tapi: { collision: { mode: "merge", override: true } },',
				'\thidden: ["!**/.*/", "!**/__*/"], // dot folders too',
				'\thook: { errors: true, pattern: "x" }',
				"});"
			].join("\n")
		);
	});

	it("wraps the per-phase api.collision form in mode, and moves the root alias", () => {
		expect(run(`await slothlet({ api: { collision: { initial: "merge", api: "replace" } } });`).code).toBe(
			`await slothlet({ api: { collision: { mode: { initial: "merge", api: "replace" } } } });`
		);
		expect(run(`await slothlet({ collision: "skip" });`).code).toBe(`await slothlet({ api: { collision: "skip" } });`);
		expect(run(`await slothlet({ api: { collision: { mode: "merge" } } });`).findings.filter((f) => f.level === "rewrite")).toEqual([]);
	});

	it("allowMutation, scanHiddenFolders, suppressFixes and permissions.enabled", () => {
		expect(run(`await slothlet({ allowMutation: false });`).code).toBe(
			`await slothlet({ api: { mutations: { add: false, remove: false, reload: false } } });`
		);
		expect(run(`await slothlet({ allowMutation: true, base: "a" });`).code).toBe(`await slothlet({ base: "a" });`);
		const opaque = run(`await slothlet({ allowMutation: flag });`);
		expect(opaque.ids("manual")).toEqual(["config|allowMutation"]);
		expect(run(`await slothlet({ scanHiddenFolders: true, hidden: ["tmp"] });`).code).toBe(
			`await slothlet({ hidden: ["tmp", "!**/.*/", "!**/__*/"] });`
		);
		expect(run(`await slothlet({ scanHiddenFolders: false });`).code).toBe(`await slothlet({});`);
		const fixes = run(`await slothlet({ suppressFixes: ["C03_116"], base: "a" });`);
		expect(fixes.code).toBe(`await slothlet({ base: "a" });`);
		expect(fixes.ids("manual")).toEqual(["config|suppressFixes"]);
		expect(run(`await slothlet({ permissions: { enabled: false } });`).code).toBe(`await slothlet({ permissions: { mode: false } });`);
	});

	it("tracking folds into loader.materialize", () => {
		expect(run(`await slothlet({ base: "a", tracking: true });`).code).toBe(
			`await slothlet({ base: "a", loader: { materialize: true } });`
		);
		const object = run(`await slothlet({ base: "a", tracking: { materialization: true } });`);
		expect(object.code).toBe(`await slothlet({ base: "a", loader: { materialize: true } });`);
		expect(object.ids("rewrite")).toEqual(["config|tracking"]);
		expect(run(`await slothlet({ base: "a", loader: { platform: "node" }, tracking: true });`).code).toBe(
			`await slothlet({ base: "a", loader: { platform: "node", materialize: true } });`
		);
		expect(run(`await slothlet({ base: "a", tracking: false });`).code).toBe(`await slothlet({ base: "a" });`);
		expect(run(`await slothlet({ base: "a", tracking: { materialization: false } });`).code).toBe(`await slothlet({ base: "a" });`);
		expect(run(`await slothlet({ backgroundMaterialize: true, tracking: true });`).code).toBe(
			`await slothlet({ loader: { materialize: true } });`
		);
		// tracking turned materialization on whatever backgroundMaterialize said: left for a hand edit.
		const conflict = run(`await slothlet({ backgroundMaterialize: false, tracking: true });`);
		expect(conflict.code).toBe(`await slothlet({ loader: { materialize: false }, tracking: true });`);
		expect(conflict.ids("manual")).toEqual(["config|tracking"]);
		expect(run(`await slothlet({ tracking: flag });`).ids("manual")).toEqual(["config|tracking"]);
	});

	it("renames the browser file list and its fullName items", () => {
		const r = run(`await slothlet({ manifest: { directories: [], files: [{ path: "a", name: "b", fullName: "c" }] } });`);
		expect(r.code).toBe(`await slothlet({ loader: { files: { directories: [], files: [{ path: "a", name: "b", full: "c" }] } } });`);
	});

	it("sanitize, typescript, versioning and clock options", () => {
		const r = run(
			`await slothlet({ sanitize: { lowerFirst: true, preserveAllLower: true, preserveAllUpper: false, rules: { leaveInsensitive: ["x"] } }, typescript: { compilerOptions: {}, types: { interfaceName: "Api" } }, versionDispatcher: fn, clock: { setTimeout: s, clearTimeout: c } });`
		);
		expect(r.code).toBe(
			`await slothlet({ sanitize: { first: true, preserve: { lower: true, upper: false }, rules: { nocase: ["x"] } }, typescript: { compiler: {}, types: { name: "Api" } }, versioning: { dispatcher: fn }, clock: { set: s, clear: c } });`
		);
	});

	it("shorthand keys keep their binding", () => {
		expect(run(`const dir = "./api";\nawait slothlet({ dir });`).code).toBe(`const dir = "./api";\nawait slothlet({ base: dir });`);
	});
});

describe("slothlet-migrate: config values defined elsewhere", () => {
	it("follows const objects passed whole, nested, or spread", () => {
		const r = run(
			`const perms = { defaultPolicy: "allow" };\nconst base = { apiDepth: 1 };\nconst config = { ...base, permissions: perms };\nawait slothlet(config);`
		);
		expect(r.code).toBe(
			`const perms = { policy: "allow" };\nconst base = { depth: 1 };\nconst config = { ...base, permissions: perms };\nawait slothlet(config);`
		);
	});

	it("leaves values it cannot see, and reports v3 keys written in other objects", () => {
		const r = run(`let opts = { defaultPolicy: "deny" };\nawait slothlet({ ...matrix, permissions: opts });`);
		expect(r.code).toBe(`let opts = { defaultPolicy: "deny" };\nawait slothlet({ ...matrix, permissions: opts });`);
		expect(r.findings).toMatchObject([{ entry: "config|permissions.defaultPolicy", level: "manual", line: 2 }]);
	});

	it("reports conflicts instead of guessing", () => {
		const r = run(`await slothlet({ dir: "a", base: "b" });`);
		expect(r.code).toBe(`await slothlet({ dir: "a", base: "b" });`);
		expect(r.findings.filter((f) => f.level === "manual")).toMatchObject([
			{ entry: "config|dir", message: expect.stringContaining("both are set") }
		]);
	});

	it("treats extra callees as slothlet()", () => {
		const r = run(`await makeApi({ apiDepth: 1 });`, { callees: ["makeApi"] });
		expect(r.code).toBe(`await makeApi({ depth: 1 });`);
	});

	it("only treats the factory imported from @cldmv/slothlet as slothlet()", () => {
		const res = migrateSource(`const slothlet = (o) => o;\nslothlet({ apiDepth: 1 });`, { filename: "x.mjs" });
		expect(res.code).toBe(`const slothlet = (o) => o;\nslothlet({ apiDepth: 1 });`);
		expect(res.findings).toMatchObject([{ entry: "config|apiDepth", level: "manual" }]);
	});

	it("knows require() and dynamic import() bindings", () => {
		const cjs = migrateSource(`const slothlet = require("@cldmv/slothlet");\nslothlet({ apiDepth: 1 });`, { filename: "x.cjs" });
		expect(cjs.code).toBe(`const slothlet = require("@cldmv/slothlet");\nslothlet({ depth: 1 });`);
		const dyn = migrateSource(`const { default: make } = await import("@cldmv/slothlet");\nmake({ apiDepth: 1 });`, { filename: "x.mjs" });
		expect(dyn.code).toBe(`const { default: make } = await import("@cldmv/slothlet");\nmake({ depth: 1 });`);
	});
});

describe("slothlet-migrate: v4 behaviour notes", () => {
	it("notes the routines default changes on a config that does not set them", () => {
		const r = run(`await slothlet({ base: "a" });`);
		expect(r.ids("info")).toEqual(["config|autoRoutines", "config|stackRoutines"]);
		expect(run(`await slothlet({ base: "a", routines: { auto: false, stack: false } });`).ids("info")).toEqual([]);
	});

	it("notes hidden patterns and the init context copy", () => {
		const r = run(`await slothlet({ hidden: ["x"], context: { user: 1 }, routines: { auto: true, stack: true } });`);
		expect(r.ids("info")).toEqual(["config|hidden", "config|context"]);
	});

	it("is idempotent: a migrated config migrates to itself", () => {
		const first = run(
			`await slothlet({ dir: "a", autoRoutines: true, stackRoutines: false, routines: [], permissions: { defaultPolicy: "deny", enabled: true }, collision: "merge" });`
		);
		const second = run(first.code);
		expect(second.code).toBe(first.code);
		expect(second.ids("rewrite")).toEqual([]);
		expect(second.ids("manual")).toEqual([]);
	});
});

describe("slothlet-migrate: config JSON files", () => {
	it("rewrites a config JSON document and keeps keys quoted", () => {
		const res = migrateJson(`{\n\t"dir": "./api",\n\t"permissions": { "defaultPolicy": "deny" }\n}\n`, {
			filename: "slothlet.config.json",
			kind: "config"
		});
		expect(res.code).toBe(`{\n\t"base": "./api",\n\t"permissions": { "policy": "deny" }\n}\n`);
	});

	it("creates quoted groups in JSON", () => {
		const res = migrateJson(`{ "autoRoutines": true, "routines": ["a"] }`, { filename: "c.json", kind: "config" });
		expect(res.code).toBe(`{ "routines": { "auto": true, "entries": ["a"] } }`);
	});

	it("reports a parse error instead of throwing", () => {
		expect(migrateJson(`{ nope`, { filename: "c.json", kind: "config" }).error).toBeTruthy();
		expect(migrateSource(`const = ;`, { filename: "x.mjs" }).error).toBeTruthy();
	});
});

describe("slothlet-migrate: collectLifecycleHooks", () => {
	const SHUTDOWN = '{ name: "^**.shutdown", mode: "shutdown", order: "depth" }';
	const DESTROY = '{ name: "^**.destroy", mode: "destroy", order: "depth" }';
	const INIT = '{ name: "initialize", mode: "startup" }';

	it("true becomes the explicit routines v3 built: defaults minus shutdown, plus the two root-anchored ones", () => {
		const r = run(`await slothlet({ dir: "a", collectLifecycleHooks: true });`);
		expect(r.code).toBe(`await slothlet({ base: "a", routines: { auto: true, entries: [${INIT}, ${SHUTDOWN}, ${DESTROY}] } });`);
		expect(r.ids("manual")).toEqual([]);
	});

	it("drops configured shutdown / destroy routines, keeps the rest, and leaves an explicit auto alone", () => {
		const r = run(
			`await slothlet({ collectLifecycleHooks: true, autoRoutines: false, routines: ["launch", "stop:shutdown", { name: "bye", mode: "destroy" }, { name: "boot", mode: "startup" }] });`
		);
		expect(r.code).toBe(
			`await slothlet({ routines: { auto: false, entries: ["launch", { name: "boot", mode: "startup" }, ${SHUTDOWN}, ${DESTROY}] } });`
		);
	});

	it("false is dropped; anything it cannot analyse is reported manual and left in place", () => {
		expect(run(`await slothlet({ collectLifecycleHooks: false });`).code).toBe("await slothlet({});");
		for (const body of [
			`await slothlet({ collectLifecycleHooks: flag });`,
			`await slothlet({ collectLifecycleHooks: true, routines: { entries: list } });`,
			`await slothlet({ collectLifecycleHooks: true, routines: { entries: ["a", name] } });`
		]) {
			const r = run(body);
			expect(r.ids("manual")).toContain("config|collectLifecycleHooks");
			expect(r.code).toContain("collectLifecycleHooks");
		}
	});
});

describe("slothlet-migrate: untouched source stays byte-identical", () => {
	it("keeps trailing comments, blank lines, odd spacing and unrelated code verbatim", () => {
		const before = [
			"const keep = {   a:1,b :  2 }; // not a config",
			"",
			"await slothlet({",
			'\tdir: "./api", // where the api lives',
			"",
			'\tmode:   "lazy",   // stays put',
			"\tdebug: true, /* block */",
			"\tapiDepth: 3 // last",
			"});",
			"function f( x ,y ){ return x+y }",
			""
		].join("\n");
		const res = migrateSource(IMPORT + before, { filename: "config.mjs" });
		expect(res.error).toBeNull();
		expect(res.code.slice(IMPORT.length)).toBe(
			[
				"const keep = {   a:1,b :  2 }; // not a config",
				"",
				"await slothlet({",
				'\tbase: "./api", // where the api lives',
				"",
				'\tmode:   "lazy",   // stays put',
				"\tdebug: true, /* block */",
				"\tdepth: 3 // last",
				"});",
				"function f( x ,y ){ return x+y }",
				""
			].join("\n")
		);
	});

	it("keeps a trailing comment on a property that moves into a group", () => {
		const r = run(`await slothlet({\n\tplatform: "node", // where\n\tbase: "a"\n});\n`);
		expect(r.code).toContain("// where");
		expect(r.code).toContain('base: "a"');
	});
});
