/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports-cross-format.test.vitest.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:30-07:00 (1791091710)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unit tests for the cross-module-system helper rule (#534): the CommonJS export-name
 * scan, the per-instance CommonJS cache, the Node load hook, and the vite plugin's load hook.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as nodeModule from "node:module";
import { scanCommonJSExports, commonJSExportNames } from "@cldmv/slothlet/helpers/cjs-export-names";
import {
	requireInInstance,
	releaseInstanceScope,
	commonJSWrapperSource,
	isCommonJSFile,
	installInstanceImportHooks,
	slothletInstanceImports
} from "@cldmv/slothlet/helpers/instance-imports";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

/**
 * The process-wide instance-import state (documented global of helpers/instance-imports).
 * @returns {object} The state.
 */
const state = () => globalThis[Symbol.for("@cldmv/slothlet.instanceImportState")];

/**
 * Names found by the scan, as an array.
 * @param {string} source - CommonJS source.
 * @returns {string[]} The names.
 */
const names = (source) => [...scanCommonJSExports(source).names];

describe("Helpers > cjs-export-names (#534)", () => {
	it("finds exports.x / module.exports.x / bracket assignments, not comparisons or other objects", () => {
		expect(names("exports.a = 1; module.exports.b = 2; exports['c'] = 3; module.exports[\"d\"] = 4;")).toEqual(["a", "b", "c", "d"]);
		expect(names("if (exports.x == 1) {} if (module.exports.y === 2) {} foo.exports.z = 3;")).toEqual([]);
	});

	it("finds Object.defineProperty exports, including TypeScript's __esModule marker", () => {
		expect(names('Object.defineProperty(exports, "__esModule", { value: true }); Object.defineProperty(module.exports, "x", {});')).toEqual(
			["__esModule", "x"]
		);
	});

	it("ignores comments but keeps strings, templates and regular expressions from hiding code", () => {
		const src = [
			"#!/usr/bin/env node",
			"// exports.lineComment = 1",
			"/* exports.blockComment = 1 */",
			'const url = "http://example.com"; exports.afterString = 1;',
			"const t = `x ${ { a: 1 }.a } y`; exports.afterTemplate = 1;",
			"const r = /\\/\\/[}{'\"]/g; exports.afterRegex = 1;",
			"const d = 4 / 2; exports.afterDivision = d / 1;",
			"function f() { return /x/.test('y'); } exports.afterReturnRegex = 1;"
		].join("\n");
		expect(names(src)).toEqual(["afterString", "afterTemplate", "afterRegex", "afterDivision", "afterReturnRegex"]);
	});

	it("handles escapes in templates and strings, spreads of non-requires, and trailing commas", () => {
		expect(names("const t = `a\\`b`; exports.afterEscapedTemplate = 1;")).toEqual(["afterEscapedTemplate"]);
		expect(names("module.exports = { a: `x\\`${'}'}`, ...other, b, };")).toEqual(["a", "b"]);
		expect(names("exports['\\x'] = 1;")).toEqual(["\\x"]);
	});

	it("survives an unterminated comment, string or template", () => {
		expect(names("exports.a = 1; /* never closed")).toEqual(["a"]);
		expect(names("exports.a = 1; const s = 'never closed")).toEqual(["a"]);
		expect(names("exports.a = 1; const s = `never ${closed")).toEqual(["a"]);
	});

	it("reads every key of a module.exports object literal, whatever the value", () => {
		const src =
			"module.exports = { a, b: c, 'd-e': 1, \"f\": 2, 3: 4, g() { return { x: 1 }; }, get h() { return 1; }, set i(v) {}," +
			" async j() {}, async *k() {}, *l() {}, get, set: 1, async, [computed]: 1, m: /}/g, n: `${'{'}`, o: (1, 2), p }";
		expect(names(src)).toEqual(["a", "b", "d-e", "f", "3", "g", "h", "i", "j", "k", "l", "get", "set", "async", "m", "n", "o", "p"]);
	});

	it("reads esbuild's 0 && (module.exports = { … }) annotation", () => {
		expect(names("module.exports = __toCommonJS(src_exports);\n0 && (module.exports = {\n  bar,\n  foo\n});")).toEqual(["bar", "foo"]);
	});

	it("collects re-exported specifiers", () => {
		const reexports = (source) => scanCommonJSExports(source).reexports;
		expect(reexports("module.exports = require('./a.cjs');")).toEqual(["./a.cjs"]);
		expect(reexports("module.exports = { ...require('./b'), x: require(\"./c\") };")).toEqual(["./b", "./c"]);
		expect(reexports('__exportStar(require("./d"), exports); __export(require("./e"));')).toEqual(["./d", "./e"]);
		expect(reexports('var _f = require("./f"); Object.keys(_f).forEach(function (key) { exports[key] = _f[key]; });')).toEqual(["./f"]);
		expect(reexports('var _g = _interopRequireWildcard(require("./g")); Object.keys(_g).forEach(function (k) {});')).toEqual(["./g"]);
		expect(reexports("Object.keys(unbound).forEach(function (k) {}); module.exports = makeApi();")).toEqual([]);
	});

	it("decodes quoted export names exactly as JavaScript would", () => {
		expect(names(`exports['a""b'] = 1;`)).toEqual(['a""b']);
		expect(names(`exports['a\\\\"b'] = 1;`)).toEqual(['a\\"b']);
		expect(names(`exports["it's"] = 1; exports['\\x41\\u0042\\u{43}'] = 2;`)).toEqual(["it's", "ABC"]);
		expect(names(`Object.defineProperty(exports, 'q"\\t', { value: 1 });`)).toEqual(['q"\t']);
		expect(names(`exports['\\u{110000}'] = 1;`)).toEqual(["\\u{110000}"]);
		// Line continuations contribute nothing.
		expect(names(`module.exports = { "a\\\nb": 1, "e\\\u2028f": 3 };`)).toEqual(["ab", "ef"]);
		// A key left unterminated at end of input after a lone backslash keeps that backslash.
		expect(names(`module.exports = { "z\\`)).toEqual(["z\\"]);
	});

	it("matches a re-export binding name literally", () => {
		const reexports = (source) => scanCommonJSExports(source).reexports;
		expect(reexports('var $_ = require("./h"); Object.keys($_).forEach(function (k) {});')).toEqual(["./h"]);
		expect(reexports('var a$b = require("./i"); Object.keys(a$b).forEach(function (k) {});')).toEqual(["./i"]);
	});

	it("follows re-exports into CommonJS files, once each, and drops default and ill-formed names", () => {
		const files = {
			"/p/index.cjs":
				"module.exports = { ...require('./a.cjs'), ...require('./missing.cjs'), ...require('./esm.mjs') }; exports.default = 1;",
			"/p/a.cjs": "exports.a = 1; exports['\\uD800'] = 2; module.exports = require('./b.js');",
			"/p/b.js": "exports.b = 1; module.exports = require('./index.cjs');"
		};
		const io = {
			readFile: (file) => files[file],
			resolve: (specifier, from) => {
				const target = path.posix.join(path.posix.dirname(from), specifier);
				if (!(target in files) && !target.endsWith(".mjs")) throw new Error("not found");
				return target;
			}
		};
		expect(commonJSExportNames("/p/index.cjs", files["/p/index.cjs"], io)).toEqual(["a", "b"]);
	});
});

describe("Helpers > instance-imports across module systems (#534)", () => {
	let root;

	beforeAll(async () => {
		installInstanceImportHooks(nodeModule);
		root = await makeTestTmpDir("instance-imports-cross");
		const write = (rel, text) => {
			fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
			fs.writeFileSync(path.join(root, rel), text);
		};
		write("package.json", "{}");
		write("helper.cjs", "let n = 0; exports.bump = () => ++n;");
		write("leaf.cjs", "const h = require('./helper.cjs'); module.exports = { bump: () => h.bump(), self: Math.random() };");
		write("esm-exports.mjs", 'const value = { custom: true }; export { value as "module.exports" };');
		write("esm-marked.mjs", "export const __esModule = false; export default 1;");
		write("esm-plain.mjs", "let n = 0; export const bump = () => ++n;");
		write(
			"requires-esm.cjs",
			"module.exports = { exp: require('./esm-exports.mjs'), marked: require('./esm-marked.mjs'), plain: require('./esm-plain.mjs'), json: require('./data.json') };"
		);
		write("data.json", '{ "ok": true }');
		write("node_modules/pkg/package.json", '{ "main": "index.cjs" }');
		write("node_modules/pkg/index.cjs", "const inner = require('./inner.cjs'); module.exports = { inner };");
		write("node_modules/pkg/inner.cjs", "module.exports = { id: Math.random() };");
		write("uses-pkg.cjs", "module.exports = require('pkg');");
		write("typed-cjs/package.json", '{ "type": "commonjs" }');
		write("typed-cjs/a.js", "export const notReallyCjs = 1;");
		write("typed-esm/package.json", '{ "type": "module" }');
		write("typed-esm/a.js", "module.exports = 1;");
		write("untyped/package.json", '{ "name": "untyped" }');
		write("untyped/cjs.js", "#!/usr/bin/env node\nmodule.exports = 1;");
		write("untyped/esm.js", "export const x = 1;");
		write("malformed/package.json", "{ not json");
		write("malformed/a.js", "module.exports = 1;");
		write("node_modules/bare/a.js", "module.exports = 1;");
		write(
			"bridge-leaf.cjs",
			"const viaEsm = require('./bridge.mjs'); const direct = require('./helper.cjs'); module.exports = { viaEsm, direct };"
		);
		write("bridge.mjs", "import helper from './helper.cjs'; export { helper };");
		write("reexporting.cjs", "module.exports = require('./helper.cjs');");
	});

	afterAll(async () => {
		await fsp.rm(root, { recursive: true, force: true });
	});

	it("keeps one helper copy per instance, evaluates a fresh leaf each time, and leaves require.cache as it was", () => {
		const leaf = path.join(root, "leaf.cjs");
		const helper = path.join(root, "helper.cjs");
		const cache = createRequire(leaf).cache;
		const hostCopy = { id: helper, exports: { host: true }, loaded: true };
		cache[helper] = hostCopy;
		const a1 = requireInInstance(leaf, "unit-a", { fresh: true });
		const a2 = requireInInstance(leaf, "unit-a", { fresh: true });
		const b = requireInInstance(leaf, "unit-b", { fresh: true });
		expect(a1.self).not.toBe(a2.self);
		expect([a1.bump(), a2.bump(), b.bump()]).toEqual([1, 2, 1]);
		expect(cache[helper]).toBe(hostCopy);
		expect(cache[leaf]).toBeUndefined();
		// A helper required directly (not fresh) is the instance's copy.
		expect(requireInInstance(helper, "unit-a").bump()).toBe(3);
		releaseInstanceScope("unit-a");
		releaseInstanceScope("unit-b");
		releaseInstanceScope(null);
		expect(requireInInstance(leaf, "unit-a", { fresh: true }).bump()).toBe(1);
		releaseInstanceScope("unit-a");
		delete cache[helper];
	});

	it("serves an instance's copy of a package file it reached earlier and puts the host's copy back", () => {
		const pkgIndex = path.join(root, "node_modules/pkg/index.cjs");
		const cache = createRequire(pkgIndex).cache;
		const first = requireInInstance(pkgIndex, "unit-pkg");
		const viaApp = requireInInstance(path.join(root, "uses-pkg.cjs"), "unit-pkg", { fresh: true });
		expect(viaApp).toBe(first);
		expect(cache[pkgIndex]).toBeUndefined();
		// With the host holding its own copy, the instance still gets its copy and the host's is restored.
		const hostCopy = createRequire(pkgIndex)(pkgIndex);
		expect(requireInInstance(path.join(root, "uses-pkg.cjs"), "unit-pkg", { fresh: true })).toBe(first);
		expect(cache[pkgIndex].exports).toBe(hostCopy);
		delete cache[pkgIndex];
		delete cache[path.join(root, "node_modules/pkg/inner.cjs")];
		releaseInstanceScope("unit-pkg");
	});

	it("evaluates a file afresh as a leaf even when the instance holds it as a helper", () => {
		const helper = path.join(root, "helper.cjs");
		const asHelper = requireInInstance(helper, "unit-fresh");
		expect(asHelper.bump()).toBe(1);
		const asLeaf = requireInInstance(helper, "unit-fresh", { fresh: true });
		expect(asLeaf).not.toBe(asHelper);
		expect(asLeaf.bump()).toBe(1);
		expect(requireInInstance(helper, "unit-fresh")).toBe(asHelper);
		releaseInstanceScope("unit-fresh");
	});

	it("shares one CommonJS helper copy between a leaf's require and an ES module it requires that imports the helper", () => {
		const out = requireInInstance(path.join(root, "bridge-leaf.cjs"), "unit-bridge", { fresh: true });
		expect(out.viaEsm.helper).toBe(out.direct);
		const other = requireInInstance(path.join(root, "bridge-leaf.cjs"), "unit-bridge-2", { fresh: true });
		expect(other.direct).not.toBe(out.direct);
		releaseInstanceScope("unit-bridge");
		releaseInstanceScope("unit-bridge-2");
	});

	it("returns what Node's require(esm) returns: a 'module.exports' export, an own __esModule, a plain namespace", () => {
		const out = requireInInstance(path.join(root, "requires-esm.cjs"), "unit-esm", { fresh: true });
		expect(out.exp).toEqual({ custom: true });
		expect(out.marked.__esModule).toBe(false);
		expect(out.marked.default).toBe(1);
		expect(out.plain.bump()).toBe(1);
		expect(out.json).toEqual({ ok: true });
		const again = requireInInstance(path.join(root, "requires-esm.cjs"), "unit-esm", { fresh: true });
		expect(again.plain).toBe(out.plain);
		const other = requireInInstance(path.join(root, "requires-esm.cjs"), "unit-esm-2", { fresh: true });
		expect(other.plain).not.toBe(out.plain);
		const leaked = Object.keys(createRequire(import.meta.url).cache).filter((k) => k.startsWith("slothlet-esm"));
		expect(leaked).toEqual([]);
		releaseInstanceScope("unit-esm");
		releaseInstanceScope("unit-esm-2");
	});

	it("generates a wrapper exporting default, 'module.exports', scanned names and an already-loaded copy's keys", () => {
		const helper = path.join(root, "helper.cjs");
		const fresh = commonJSWrapperSource(helper, "unit-w", null);
		expect(fresh).toContain('export { n0 as "bump" };');
		expect(fresh).toContain("export default m;");
		expect(fresh).toContain('export { m as "module.exports" };');
		state().scopes.set("unit-w", new Map([[helper, { loaded: true, exports: { bump() {}, late: 1, default: 2 } }]]));
		const withLoaded = commonJSWrapperSource(helper, "unit-w", new TextEncoder().encode("exports.bump = 1;"));
		expect(withLoaded).toContain('as "late"');
		expect(withLoaded).not.toContain('as "default"');
		state().scopes.set("unit-w", new Map([[helper, { loaded: true, exports: 42 }]]));
		expect(commonJSWrapperSource(helper, "unit-w", "exports.only = 1;")).toContain('as "only"');
		// A re-export is followed into the required file.
		expect(commonJSWrapperSource(path.join(root, "reexporting.cjs"), "unit-w", null)).toContain('as "bump"');
		releaseInstanceScope("unit-w");
	});

	it("decides CommonJS the way Node does", () => {
		expect(isCommonJSFile(path.join(root, "helper.cjs"))).toBe(true);
		expect(isCommonJSFile(path.join(root, "esm-plain.mjs"))).toBe(false);
		expect(isCommonJSFile(path.join(root, "typed-cjs/a.js"))).toBe(true);
		expect(isCommonJSFile(path.join(root, "typed-esm/a.js"))).toBe(false);
		expect(isCommonJSFile(path.join(root, "untyped/cjs.js"))).toBe(true);
		expect(isCommonJSFile(path.join(root, "untyped/esm.js"))).toBe(false);
		expect(isCommonJSFile(path.join(root, "malformed/a.js"))).toBe(false);
		// No package.json inside the package: the walk stops at node_modules, then syntax decides.
		expect(isCommonJSFile(path.join(root, "node_modules/bare/a.js"))).toBe(true);
		expect(isCommonJSFile(path.join(root, "missing.js"))).toBe(false);
	});

	describe("Node hooks", () => {
		let hooks;

		beforeAll(() => {
			installInstanceImportHooks({ registerHooks: (h) => (hooks = h) }, {});
		});

		it("resolves the require(esm) virtual modules to themselves", () => {
			const next = () => {
				throw new Error("must not resolve");
			};
			expect(hooks.resolve("slothlet-esm:file:///x.mjs?slothlet_instance=a", {}, next)).toEqual({
				url: "slothlet-esm:file:///x.mjs?slothlet_instance=a",
				format: "module",
				shortCircuit: true
			});
			expect(hooks.resolve("slothlet-esm-facade:file:///x.mjs?slothlet_instance=a", {}, next).shortCircuit).toBe(true);
		});

		it("passes unmarked and non-file loads through unchanged", () => {
			const result = { format: "module", source: "" };
			const next = () => result;
			expect(hooks.load("file:///x.mjs", {}, next)).toBe(result);
			expect(hooks.load("data:text/javascript,1?slothlet_instance=a", {}, next)).toBe(result);
			expect(hooks.load("file:///x.mjs?slothlet_instance=a", {}, next)).toBe(result);
		});

		it("answers the virtual modules with re-export source", () => {
			const next = () => {
				throw new Error("must not load");
			};
			expect(hooks.load("slothlet-esm:file:///x.mjs?slothlet_instance=a", {}, next).source).toContain('export { ns as "module.exports" }');
			expect(hooks.load("slothlet-esm-facade:file:///x.mjs?slothlet_instance=a", {}, next).source).toContain(
				"export const __esModule = true;"
			);
		});

		it("serves a scoped require of an ES module through a CommonJS stub, and leaves CommonJS alone", () => {
			const url = "file:///x.mjs?slothlet_instance=a&slothlet_require=1";
			const stub = hooks.load(url, {}, () => ({ format: "module", source: "" }));
			expect(stub.format).toBe("commonjs");
			expect(stub.source).toContain('requireESM("file:///x.mjs?slothlet_instance=a")');
			const cjs = { format: "commonjs", source: "" };
			expect(hooks.load("file:///x.js?slothlet_instance=a&slothlet_require=1", {}, () => cjs)).toBe(cjs);
		});

		it("wraps an instance-marked CommonJS module, reading the file when the loader gave no source", () => {
			const helper = path.join(root, "helper.cjs");
			const url = `${new URL(`file://${helper}`).href}?slothlet_instance=unit-h`;
			const out = hooks.load(url, {}, () => ({ format: "commonjs", source: null }));
			expect(out.format).toBe("module");
			expect(out.source).toContain('as "bump"');
			const noInstance = { format: "commonjs", source: null };
			expect(hooks.load(`${new URL(`file://${helper}`).href}?x=1&a_slothlet_instance=1`, {}, () => noInstance)).toBe(noInstance);
		});

		it("marks only relative require()s from the active scope's files that resolve to a possible ES module", () => {
			const s = state();
			const outer = s.active;
			const leaf = path.join(root, "leaf.cjs");
			s.active = { instanceID: "a b", anchor: leaf };
			try {
				const parentURL = new URL(`file://${leaf}`).href;
				const req = new Set(["require", "node"]);
				const at = (url) => () => ({ url });
				const esm = new URL(`file://${path.join(root, "esm-plain.mjs")}`).href;
				expect(hooks.resolve("./esm-plain.mjs", { parentURL, conditions: req }, at(esm)).url).toBe(
					`${esm}?slothlet_instance=a+b&slothlet_require=1`
				);
				expect(hooks.resolve("./esm-plain.mjs", { parentURL, conditions: ["require"] }, at(esm)).url).toContain("slothlet_require=1");
				// Not marked: an import, a bare specifier, a query already present, CommonJS/JSON/addon targets,
				// non-file targets, a parent outside the scope, a target in another package.
				expect(hooks.resolve("./esm-plain.mjs", { parentURL, conditions: ["import"] }, at(esm)).url).toBe(esm);
				expect(hooks.resolve("./esm-plain.mjs", { parentURL }, at(esm)).url).toBe(esm);
				expect(hooks.resolve("pkg", { parentURL, conditions: req }, at(esm)).url).toBe(esm);
				expect(hooks.resolve("./x", { parentURL, conditions: req }, at(`${esm}?q=1`)).url).toBe(`${esm}?q=1`);
				for (const ext of ["cjs", "json", "node"]) {
					expect(hooks.resolve("./x", { parentURL, conditions: req }, at(`file:///app/x.${ext}`)).url).toBe(`file:///app/x.${ext}`);
				}
				expect(hooks.resolve("./x", { parentURL, conditions: req }, at("node:fs")).url).toBe("node:fs");
				expect(hooks.resolve("./x", { parentURL, conditions: req }, () => ({})).url).toBeUndefined();
				const pkgParent = new URL(`file://${path.join(root, "node_modules/pkg/index.cjs")}`).href;
				expect(hooks.resolve("./x.mjs", { parentURL: pkgParent, conditions: req }, at(esm)).url).toBe(esm);
				expect(hooks.resolve("./x.mjs", { conditions: req }, at(esm)).url).toBe(esm);
				const pkgFile = new URL(`file://${path.join(root, "node_modules/pkg/x.mjs")}`).href;
				expect(hooks.resolve("./node_modules/pkg/x.mjs", { parentURL, conditions: req }, at(pkgFile)).url).toBe(pkgFile);
			} finally {
				s.active = outer;
			}
		});
	});

	describe("vite plugin load", () => {
		const plugin = slothletInstanceImports();

		it("loads an instance-marked CommonJS file as the per-instance wrapper", () => {
			const out = plugin.load(`${path.join(root, "helper.cjs")}?slothlet_instance=unit-v`);
			expect(out.code).toContain("requireCJS(");
			expect(out.code).toContain('as "bump"');
		});

		it("defers everything else to vite", () => {
			expect(plugin.load(undefined)).toBe(null);
			expect(plugin.load(path.join(root, "helper.cjs"))).toBe(null);
			expect(plugin.load(`${path.join(root, "esm-plain.mjs")}?slothlet_instance=unit-v`)).toBe(null);
			expect(plugin.load(`${path.join(root, "helper.cjs")}?not_slothlet_instance=1`)).toBe(null);
		});
	});
});
