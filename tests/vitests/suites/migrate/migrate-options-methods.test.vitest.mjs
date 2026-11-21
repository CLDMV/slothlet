/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-options-methods.test.vitest.mjs
 *	@Date: 2026-11-16T16:19:22-08:00 (1794874762)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:29:20-08:00 (1794875360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet-migrate: method option objects, method renames / folds in member chains,
 * permission rule targets, and imports.
 * @module tests/vitests/suites/migrate/migrate-options-methods.test.vitest
 */

import { describe, it, expect } from "vitest";
import { migrateSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

/**
 * Migrate a snippet.
 * @param {string} code - Source.
 * @returns {{ code: string, findings: object[], ids: (level?: string) => string[] }} Result.
 */
function run(code) {
	const res = migrateSource(code, { filename: "code.mjs" });
	expect(res.error).toBeNull();
	return { ...res, ids: (level) => res.findings.filter((f) => !level || f.level === level).map((f) => f.entry) };
}

describe("slothlet-migrate: api.add", () => {
	it("rewrites option keys and folds the 4th argument into options.version", () => {
		const r = run(
			`await api.slothlet.api.add("auth", "./v1", { collisionMode: "merge", forceOverwrite: true, mutateExisting: false, moduleID: "auth-v1", recordHistory: true }, { version: "v1", default: true, metadata: { a: 1 } });`
		);
		expect(r.code).toBe(
			`await api.slothlet.api.add("auth", "./v1", { collision: { mode: "merge", force: true, mutate: false }, id: "auth-v1", replay: true, version: { tag: "v1", default: true, metadata: { a: 1 } } });`
		);
	});

	it("handles missing, nullish and non-literal options next to a version argument", () => {
		expect(run(`api.slothlet.api.add("a", "./a", undefined, { version: "v2" });`).code).toBe(
			`api.slothlet.api.add("a", "./a", { version: { tag: "v2" } });`
		);
		expect(run(`api.slothlet.api.add("a", "./a", opts, { version: "v2" });`).code).toBe(
			`api.slothlet.api.add("a", "./a", { ...opts, version: { tag: "v2" } });`
		);
		expect(run(`api.slothlet.api.add("a", "./a", {}, null);`).code).toBe(`api.slothlet.api.add("a", "./a", {});`);
		expect(run(`api.slothlet.api.add("a", "./a", null, null);`).code).toBe(`api.slothlet.api.add("a", "./a");`);
		const opaque = run(`api.slothlet.api.add("a", "./a", {}, vc);`);
		expect(opaque.code).toBe(`api.slothlet.api.add("a", "./a", {}, vc);`);
		expect(opaque.ids("manual")).toEqual(["option|api.slothlet.api.add(versionConfig)"]);
	});

	it("scanHiddenFolders on api.add becomes hidden patterns; hidden gets a behaviour note", () => {
		const r = run(`self.slothlet.api.add("a", "./a", { scanHiddenFolders: true });\nself.slothlet.api.add("b", "./b", { hidden: ["x"] });`);
		expect(r.code).toBe(
			`self.slothlet.api.add("a", "./a", { hidden: ["!**/.*/", "!**/__*/"] });\nself.slothlet.api.add("b", "./b", { hidden: ["x"] });`
		);
		expect(r.ids("info")).toEqual(["option|api.slothlet.api.add(options).hidden"]);
	});
});

describe("slothlet-migrate: other method options", () => {
	it("api.remove swaps v3 (moduleID, apiPath) when the first argument is a module id this file mounts", () => {
		const r = run(`api.slothlet.api.add("math", "./m", { moduleID: "ext" });\napi.slothlet.api.remove("ext", "math");`);
		expect(r.code).toBe(`api.slothlet.api.add("math", "./m", { id: "ext" });\napi.slothlet.api.remove("math", "ext");`);
		expect(run(r.code).ids("rewrite")).toEqual([]);
		const unknown = run(`api.slothlet.api.remove(a, "math");`);
		expect(unknown.ids("manual")).toEqual(["option|api.slothlet.api.remove(pathOrModuleId, apiPath)"]);
		expect(run(`api.slothlet.api.remove("math");`).findings).toEqual([]);
	});

	it("reload keepInstanceID becomes instance", () => {
		expect(run(`await api.slothlet.reload({ keepInstanceID: true });`).code).toBe(`await api.slothlet.reload({ instance: "keep" });`);
		expect(run(`await api.slothlet.reload({ keepInstanceID: false });`).code).toBe(`await api.slothlet.reload({ instance: "new" });`);
		expect(run(`await api.slothlet.reload({ keepInstanceID: a && b });`).code).toBe(
			`await api.slothlet.reload({ instance: (a && b) ? "keep" : "new" });`
		);
		expect(run(`await api.slothlet.reload({ keepInstanceID: keep });`).code).toBe(
			`await api.slothlet.reload({ instance: keep ? "keep" : "new" });`
		);
	});

	it("hook.on pattern prefix form and options", () => {
		const r = run(
			`api.slothlet.hook.on('before:math.*', fn, { lockCaller: true, versioned: true, versionDispatcher: d });\napi.slothlet.hook.on("math.*:after", fn);`
		);
		expect(r.code).toBe(
			`api.slothlet.hook.on('math.*:before', fn, { pin: true, versioning: { enabled: true, dispatcher: d } });\napi.slothlet.hook.on("math.*:after", fn);`
		);
		expect(run("api.slothlet.hook.on(`before:${p}`, fn);").ids("manual")).toEqual(["option|api.slothlet.hook.on(pattern)"]);
	});

	it("modules.* fold into modules.add and move their options", () => {
		const r = run(
			[
				`await api.slothlet.api.modules.addDiscovered({ scanRoot: "/x", prefix: "@a/", filter: f, manifest: "m.json", schema: s, collisionMode: "merge", onFailure: "rollback" });`,
				`await api.slothlet.api.modules.addModule("pkg", { collisionMode: "skip" });`,
				`await api.slothlet.api.modules.addModules(list, { onFailure: "best-effort" });`,
				`api.slothlet.api.modules.discover({ scanRoot: "/x" });`,
				`api.slothlet.api.modules.clearDiscoveryCache();`,
				`api.slothlet.api.modules.removeModule("pkg");`
			].join("\n")
		);
		expect(r.code).toBe(
			[
				`await api.slothlet.api.modules.add({ discover: { root: "/x", prefix: "@a/", filter: f, manifest: "m.json", schema: s }, collision: { mode: "merge" }, failure: "rollback" });`,
				`await api.slothlet.api.modules.add("pkg", { collision: { mode: "skip" } });`,
				`await api.slothlet.api.modules.add(list, { failure: "best-effort" });`,
				`api.slothlet.api.modules.discover({ root: "/x" });`,
				`api.slothlet.api.modules.cache.clear();`,
				`api.slothlet.api.modules.remove("pkg");`
			].join("\n")
		);
	});

	it("leaves and principal.register options", () => {
		const r = run(
			`api.slothlet.api.leaves("x", { includePrivate: true });\napi.slothlet.permissions.principal.register("p", { maxAge: 10, resolve });`
		);
		expect(r.code).toBe(
			`api.slothlet.api.leaves("x", { private: true });\napi.slothlet.permissions.principal.register("p", { ttl: 10, resolve });`
		);
	});
});

describe("slothlet-migrate: method chains", () => {
	it("renames and moves method paths on api.slothlet and self.slothlet", () => {
		const lines = [
			["api.slothlet.diag.getAPI()", "api.slothlet.diag.api()"],
			["self.slothlet.diag.caches.getAllModuleIDs()", "self.slothlet.diag.caches.ids()"],
			["api.slothlet.diag.getOwnership()", "api.slothlet.diag.owner.list()"],
			['api.slothlet.diag.owner("a.b")', 'api.slothlet.diag.owner.get("a.b")'],
			['api.slothlet.event.resolveLevel(s, "e")', 'api.slothlet.event.level(s, "e")'],
			["api.slothlet.hook.enablePattern(p)", "api.slothlet.hook.pattern.enable(p)"],
			['api.slothlet.i18n.setLanguageAsync("fr-fr")', 'api.slothlet.i18n.language.set("fr-fr")'],
			["api.slothlet.instanceID", "api.slothlet.instance.id"],
			["api.slothlet.materialize.materialized", "api.slothlet.materialize.complete"],
			['api.slothlet.metadata.setFor("a.b", "k", 1)', 'api.slothlet.metadata.set("a.b", "k", 1)'],
			["api.slothlet.metadata.setGlobal(m)", "api.slothlet.metadata.global(m)"],
			["api.slothlet.permissions.global.checkAccess(c, t)", "api.slothlet.permissions.global.check.access(c, t)"],
			["api.slothlet.permissions.removeRule(id)", "api.slothlet.permissions.rules.remove(id)"],
			["self.slothlet.lockCaller(fn)", "self.slothlet.pin(fn)"],
			["self.slothlet.lockCaller.caller", "self.slothlet.pin.caller"],
			["api.slothlet.run({ a: 1 }, fn)", "api.slothlet.context.run({ a: 1 }, fn)"],
			['api.slothlet.versioning.setVersionMetadata("p", "v1", m)', 'api.slothlet.versioning.metadata.set("p", "v1", m)'],
			["api.slothlet.permissions.control.readGating(true)", "api.slothlet.permissions.control.gating.read(true)"],
			["const g = api.slothlet.permissions.control.readGatingEnabled", "const g = api.slothlet.permissions.control.gating.read()"],
			["api.slothlet.permissions.control.enable()", 'api.slothlet.permissions.control.mode("on")'],
			["const on = api.slothlet.permissions.control.enabled", 'const on = api.slothlet.permissions.control.mode() === "on"'],
			["x = !api.slothlet.permissions.control.enabled", 'x = !(api.slothlet.permissions.control.mode() === "on")'],
			["const m = api.slothlet.permissions.control.mode", "const m = api.slothlet.permissions.control.mode()"]
		];
		for (const [from, to] of lines) {
			const r = run(`${from};`);
			expect(r.code, from).toBe(`${to};`);
			expect(run(r.code).ids("rewrite"), to).toEqual([]);
		}
	});

	it("reports what it cannot prove", () => {
		expect(run(`api.slothlet.metadata.getForVersion("auth", "v1");`).ids("manual")).toEqual(["method|api.slothlet.metadata.getForVersion"]);
		expect(run(`api.slothlet.context.inspect();`).ids("manual")).toEqual(["method|api.slothlet.context.inspect"]);
		expect(run(`api.slothlet.permissions.control.mode = "off";`).ids("manual")).toEqual(["method|api.slothlet.permissions.control.mode"]);
		expect(run(`api.slothlet.permissions.control.disable(x);`).ids("manual")).toEqual(["method|api.slothlet.permissions.control.disable"]);
		expect(run(`api.slothlet?.diag?.getAPI();`).ids("manual")).toEqual(["method|api.slothlet.diag.getAPI"]);
		const destructured = run(`const { metadata } = api.slothlet;\nmetadata.getFor(fn);`);
		expect(destructured.ids("manual")).toEqual(["method|api.slothlet.metadata.getFor"]);
	});

	it("notes metadata.get behaviour where it is used", () => {
		const r = run(`await api.slothlet.metadata.getFor(fn);\napi.slothlet.metadata.get(fn);`);
		expect(r.code).toBe(`await api.slothlet.metadata.get(fn);\napi.slothlet.metadata.get(fn);`);
		expect(r.ids("info")).toEqual(["method|api.slothlet.metadata.getFor", "method|api.slothlet.metadata.get"]);
	});
});

describe("slothlet-migrate: permission rule targets", () => {
	it("rewrites exact targets and trailing globs; keeps suffixes", () => {
		const r = run(
			`api.slothlet.permissions.addRule({ caller: "**", target: "slothlet.lockCaller.*", effect: "deny" });\nconst rules = [{ caller: "a", target: "slothlet.diag.getAPI:read", effect: "allow" }, { caller: "a", target: "db.**", effect: "allow" }];`
		);
		expect(r.code).toBe(
			`api.slothlet.permissions.rules.add({ caller: "**", target: "slothlet.pin.*", effect: "deny" });\nconst rules = [{ caller: "a", target: "slothlet.diag.api:read", effect: "allow" }, { caller: "a", target: "db.**", effect: "allow" }];`
		);
	});

	it("reports folds and globs whose coverage moved", () => {
		const fold = run(`const r = { caller: "x", target: "slothlet.metadata.setFor", effect: "allow" };`);
		expect(fold.code).toBe(`const r = { caller: "x", target: "slothlet.metadata.setFor", effect: "allow" };`);
		expect(fold.ids("manual")).toEqual(["method|api.slothlet.metadata.setFor"]);
		const glob = run(`const r = { caller: "x", target: "slothlet.permissions.*", effect: "deny" };`);
		expect(glob.ids("manual")).toEqual(
			expect.arrayContaining(["method|api.slothlet.permissions.addRule", "method|api.slothlet.permissions.removeRule"])
		);
		expect(run(`const r = { caller: "x", target: "slothlet.diag.owner.get", effect: "deny" };`).findings).toEqual([]);
	});
});

describe("slothlet-migrate: imports", () => {
	it("renames imported names keeping the local binding", () => {
		const r = run(
			`import { generateTypes } from "@cldmv/slothlet/typegen";\nimport { sanitizePropertyName as sp } from "@cldmv/slothlet/helpers/sanitize";\nimport { initI18n } from '@cldmv/slothlet/i18n';\nimport { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";\nimport slothlet from "@cldmv/slothlet/slothlet";`
		);
		expect(r.code).toBe(
			`import { generate as generateTypes } from "@cldmv/slothlet/typegen";\nimport { sanitize as sp } from "@cldmv/slothlet/sanitize";\nimport { init as initI18n } from '@cldmv/slothlet/i18n';\nimport { plugin as slothletInstanceImports } from "@cldmv/slothlet/vite";\nimport slothlet from "@cldmv/slothlet";`
		);
	});

	it("handles require() and import() destructuring", () => {
		const r = run(
			`const { generateTypes, foo: bar } = require("@cldmv/slothlet/typegen");\nconst { initI18n } = await import("@cldmv/slothlet/i18n");`
		);
		expect(r.code).toBe(
			`const { generate: generateTypes, foo: bar } = require("@cldmv/slothlet/typegen");\nconst { init: initI18n } = await import("@cldmv/slothlet/i18n");`
		);
	});

	it("reports private, removed and namespace moves", () => {
		const r = run(
			`import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";\nimport { Sanitize, sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";\nimport { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";\nimport { instanceID } from "@cldmv/slothlet/runtime";\nvi.mock("@cldmv/slothlet/helpers/config");`
		);
		expect(r.code).toBe(
			`import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";\nimport { Sanitize, sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";\nimport { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";\nimport { instanceID } from "@cldmv/slothlet/runtime";\nvi.mock("@cldmv/slothlet/helpers/config");`
		);
		expect(r.ids("manual")).toEqual([
			"export|@cldmv/slothlet/helpers/resolve-from-caller",
			"export|@cldmv/slothlet/helpers/sanitize#Sanitize",
			"export|@cldmv/slothlet/helpers/sanitize#sanitizePropertyName",
			"export|@cldmv/slothlet/helpers/generate-manifest#generateManifest",
			"export|@cldmv/slothlet/runtime#instanceID",
			"export|@cldmv/slothlet/helpers/config"
		]);
	});

	it("rewrites generateTypes() options through the local binding", () => {
		const r = run(
			`import { generateTypes as gen } from "@cldmv/slothlet/typegen";\nawait gen({ dir: "./api", output: "x.d.ts", interfaceName: "Api", includeDocumentation: true, augmentRuntime: false });`
		);
		expect(r.code).toBe(
			`import { generate as gen } from "@cldmv/slothlet/typegen";\nawait gen({ base: "./api", output: "x.d.ts", name: "Api", docs: true, augment: false });`
		);
	});

	it("leaves unaffected slothlet imports alone", () => {
		const code = `import slothlet from "@cldmv/slothlet";\nimport { self, context } from "@cldmv/slothlet/runtime";\nimport { SlothletError } from "@cldmv/slothlet/errors";`;
		expect(run(code).findings).toEqual([]);
	});
});

describe("slothlet-migrate: node fields and internals", () => {
	it("reports framework keys read off nodes and v3 metadata fields", () => {
		const r = run(
			`use(api.math.__type, api.math.__filePath, "__impl" in fn, fn._materialize);\nconst meta = await api.slothlet.metadata.getFor(fn);\nuse(meta.filePath, meta.taggedAt);`
		);
		expect(r.findings.filter((f) => f.level === "manual")).toMatchObject([
			{ entry: "node-field|<node>.__type" },
			{ entry: "node-field|<node>.__filePath", also: ["internal|__filePath (impl marker)"] },
			{ entry: "internal|__impl" },
			{ entry: "internal|_materialize" },
			{ entry: "node-field|metadata.filePath" },
			{ entry: "node-field|metadata.taggedAt" }
		]);
	});
});

describe("slothlet-migrate: places the first pass missed", () => {
	it("renames discover.scanRoot nested in addModule / addModules options", () => {
		const r = run(
			[
				`await api.slothlet.api.modules.addModule("pkg", { discover: { scanRoot: "/x" }, collisionMode: "skip" });`,
				`await api.slothlet.api.modules.addModules(list, { discover: { scanRoot: "/y" } });`
			].join("\n")
		);
		expect(r.code).toBe(
			[
				`await api.slothlet.api.modules.add("pkg", { discover: { root: "/x" }, collision: { mode: "skip" } });`,
				`await api.slothlet.api.modules.add(list, { discover: { root: "/y" } });`
			].join("\n")
		);
	});

	it("rewrites option keys that sit beside exports in the inline api.add form", () => {
		const r = run(
			`await api.slothlet.api.add("svc", { exports: { collisionMode: "kept" }, collisionMode: "merge", forceOverwrite: true, moduleID: "m" });`
		);
		expect(r.code).toBe(
			`await api.slothlet.api.add("svc", { exports: { collisionMode: "kept" }, collision: { mode: "merge", force: true }, id: "m" });`
		);
		expect(r.ids("manual")).toEqual([]);
	});

	it("follows a provable const alias of a slothlet chain", () => {
		const r = run(
			[
				`const mm = api.slothlet.api.modules;`,
				`mm.discover({ scanRoot: "/x" });`,
				`await mm.addModule("pkg", { collisionMode: "skip" });`,
				`mm.clearDiscoveryCache();`
			].join("\n")
		);
		expect(r.code).toBe(
			[
				`const mm = api.slothlet.api.modules;`,
				`mm.discover({ root: "/x" });`,
				`await mm.add("pkg", { collision: { mode: "skip" } });`,
				`mm.cache.clear();`
			].join("\n")
		);
		expect(r.ids("manual")).toEqual([]);
	});

	it("reports, and does not edit, calls through an alias it cannot prove constant", () => {
		const r = run([`let mm = api.slothlet.api.modules;`, `mm.discover({ scanRoot: "/x" });`, `mm.removeModule("pkg");`].join("\n"));
		expect(r.code).toContain(`mm.removeModule("pkg")`);
		expect(r.code).toContain(`scanRoot`);
		expect(r.ids("manual")).toContain("method|api.slothlet.api.modules.removeModule");
	});
});
