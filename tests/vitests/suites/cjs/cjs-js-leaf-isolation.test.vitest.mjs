/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/cjs/cjs-js-leaf-isolation.test.vitest.mjs
 *	@Date: 2026-09-28T20:31:41-07:00 (1790652701)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:00-07:00 (1791090900)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `.js` leaf that Node treats as CommonJS is loaded per instance, like a `.cjs` leaf (#521).
 *
 * @description
 * Node decides a `.js` file's format from the nearest package.json: `"type": "module"` → ES module,
 * `"type": "commonjs"` → CommonJS, and no `type` → syntax detection (CommonJS unless the source only
 * parses as an ES module). Before #521 only `.cjs` took the loader's per-instance CommonJS path; a
 * CommonJS `.js` went through `import()` with a `?slothlet_instance=` query, which Node's CommonJS
 * cache ignores — so two instances shared one module scope.
 *
 * Fixture `api_tests/api_test_cjs_js/` holds one package per case, each with a `counter` leaf whose
 * `next()` increments a module-scope counter:
 * - `commonjs/`   — `"type": "commonjs"`, CommonJS `.js`
 * - `untypedcjs/` — no `type`, CommonJS `.js` (plus a hashbang leaf, `shebang/`)
 * - `untypedesm/` — no `type`, ESM-syntax `.js` (Node's syntax detection loads it as ESM)
 * - `esm/`        — `"type": "module"`, ESM `.js` (control)
 *
 * Every case must give each instance, each reload, and each `api.slothlet.api.add` mount its own
 * module scope. The test runner's module runner evaluates each distinct `import()` URL afresh, which
 * masks the bug for files it inlines, so the regression check proper runs slothlet in a child Node
 * process (the "native Node" block).
 */

import { describe, it, expect, afterEach } from "vitest";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { API_TEST_BASE } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const FIXTURE = path.join(REPO_ROOT, API_TEST_BASE, "api_test_cjs_js");

/** Each case: the api key of the package and the leaf holding `next()`. */
const CASES = [
	{ label: '"type": "commonjs" + CommonJS .js', pkg: "commonjs", leaf: "counter" },
	{ label: "no type + CommonJS .js", pkg: "untypedcjs", leaf: "counter" },
	{ label: "no type + CommonJS .js with a hashbang", pkg: "untypedcjs", leaf: "shebang" },
	{ label: "no type + ESM-syntax .js", pkg: "untypedesm", leaf: "counter" },
	{ label: '"type": "module" + ESM .js (control)', pkg: "esm", leaf: "counter" }
];

const MODES = ["eager", "lazy"];

describe("CommonJS .js leaves load per instance (#521)", () => {
	const instances = [];
	const tmpDirs = [];

	/**
	 * Create a tracked slothlet instance.
	 * @param {object} config - slothlet config.
	 * @returns {Promise<object>} The api.
	 */
	const make = async (config) => {
		const api = await slothlet({ silent: true, ...config });
		instances.push(api);
		return api;
	};

	afterEach(async () => {
		while (instances.length) await instances.pop().shutdown();
		while (tmpDirs.length) await fsp.rm(tmpDirs.pop(), { recursive: true, force: true });
	});

	for (const mode of MODES) {
		describe(`${mode} mode`, () => {
			for (const { label, pkg, leaf } of CASES) {
				it(`${label}: two instances do not share module scope`, async () => {
					const a = await make({ base: FIXTURE, mode });
					const b = await make({ base: FIXTURE, mode });

					expect(await a[pkg][leaf].next()).toBe(1);
					expect(await a[pkg][leaf].next()).toBe(2);
					expect(await b[pkg][leaf].next()).toBe(1);
					expect(await a[pkg][leaf].next()).toBe(3);
				});

				it(`${label}: reload gives a fresh scope without touching the other instance`, async () => {
					const a = await make({ base: FIXTURE, mode });
					const b = await make({ base: FIXTURE, mode });

					await a[pkg][leaf].next();
					await a[pkg][leaf].next();
					expect(await b[pkg][leaf].next()).toBe(1);

					await a.slothlet.reload();
					expect(await a[pkg][leaf].next()).toBe(1);
					expect(await b[pkg][leaf].next()).toBe(2);
				});

				it(`${label}: an api.slothlet.api.add mount gets its own scope`, async () => {
					const a = await make({ base: FIXTURE, mode });

					expect(await a[pkg][leaf].next()).toBe(1);
					await a.slothlet.api.add("mounted", path.join(FIXTURE, pkg));
					expect(await a.mounted[leaf].next()).toBe(1);
					expect(await a[pkg][leaf].next()).toBe(2);
					expect(await a.mounted[leaf].next()).toBe(2);
				});
			}

			it("no type + ESM-syntax .js is still evaluated as an ES module", async () => {
				const a = await make({ base: FIXTURE, mode });
				expect(await a.untypedesm.counter.isModule()).toBe(true);
			});
		});
	}

	/**
	 * Write a package with one CommonJS `.js` counter leaf.
	 * @param {string} dir - Package directory.
	 * @param {string|null} pkgJson - package.json text, or null for none.
	 * @returns {Promise<void>}
	 */
	const writeCounterPackage = async (dir, pkgJson) => {
		await fsp.mkdir(path.join(dir, "counter"), { recursive: true });
		if (pkgJson !== null) await fsp.writeFile(path.join(dir, "package.json"), pkgJson);
		await fsp.writeFile(path.join(dir, "counter", "counter.js"), "let count = 0;\nmodule.exports = { next: () => ++count };\n");
	};

	it("a .js under a node_modules boundary with no package.json below it is CommonJS", async () => {
		// Node's package-scope lookup stops at a node_modules segment, so the repo's own
		// "type": "module" package.json above it does not apply.
		const root = await makeTestTmpDir("cjs-js-node-modules");
		tmpDirs.push(root);
		const base = path.join(root, "node_modules");
		await writeCounterPackage(base, null);

		const a = await make({ base, mode: "eager" });
		const b = await make({ base, mode: "eager" });
		expect(a.counter.next()).toBe(1);
		expect(a.counter.next()).toBe(2);
		expect(b.counter.next()).toBe(1);
	});

	it("a .js with no package.json anywhere above it is CommonJS", async () => {
		// Needs a location with no package.json up to the filesystem root, which rules out the repo's
		// tmp/ (the repo root has one), so this uses the system temp directory and removes it after.
		const root = await fsp.mkdtemp(path.join(os.tmpdir(), "slothlet-cjs-js-"));
		tmpDirs.push(root);
		await writeCounterPackage(root, null);

		const a = await make({ base: root, mode: "eager" });
		const b = await make({ base: root, mode: "eager" });
		expect(a.counter.next()).toBe(1);
		expect(a.counter.next()).toBe(2);
		expect(b.counter.next()).toBe(1);
	});

	it("a malformed package.json is left to the module loader to report", async () => {
		const root = await makeTestTmpDir("cjs-js-bad-pkg");
		tmpDirs.push(root);
		await writeCounterPackage(root, "{ not json");

		await expect(make({ base: root, mode: "eager" })).rejects.toThrow();
	});

	it("an unrecognised package.json type is ignored, as Node ignores it", async () => {
		const root = await makeTestTmpDir("cjs-js-odd-type");
		tmpDirs.push(root);
		await writeCounterPackage(root, '{ "type": "script" }\n');

		const a = await make({ base: root, mode: "eager" });
		expect(a.counter.next()).toBe(1);
	});
});

/**
 * The suites above run inside the test runner, whose own module runner evaluates every distinct
 * `import()` URL afresh — which hides the bug for files it inlines. Native Node keys its CommonJS cache
 * on the file path alone, so the real regression check runs slothlet in a plain child Node process.
 */
describe("CommonJS .js leaves load per instance under native Node (#521)", () => {
	let root;

	afterEach(async () => {
		if (root) await fsp.rm(root, { recursive: true, force: true });
		root = undefined;
	});

	/**
	 * Run the two-instance / reload / mount scenario for every case in a child Node process.
	 * @param {string} mode - `"eager"` or `"lazy"`.
	 * @returns {Promise<object>} Per-package results.
	 */
	const runNative = async (mode) => {
		root = await makeTestTmpDir(`cjs-js-native-${mode}`);
		const script = [
			`import slothlet from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "index.mjs")).href)};`,
			`const base = ${JSON.stringify(FIXTURE)};`,
			`const cases = ${JSON.stringify(CASES.map(({ pkg, leaf }) => ({ pkg, leaf })))};`,
			`const a = await slothlet({ base, mode: ${JSON.stringify(mode)}, silent: true });`,
			`const b = await slothlet({ base, mode: ${JSON.stringify(mode)}, silent: true });`,
			`const out = {};`,
			`for (const { pkg, leaf } of cases) {`,
			`	const r = (out[pkg + "." + leaf] = {});`,
			`	r.a = [await a[pkg][leaf].next(), await a[pkg][leaf].next()];`,
			`	r.b = [await b[pkg][leaf].next()];`,
			`}`,
			`await a.slothlet.reload();`,
			`for (const { pkg, leaf } of cases) {`,
			`	const r = out[pkg + "." + leaf];`,
			`	r.aAfterReload = await a[pkg][leaf].next();`,
			`	r.bAfterReload = await b[pkg][leaf].next();`,
			`}`,
			`for (const { pkg } of cases) await b.slothlet.api.add("mounted_" + pkg, base + "/" + pkg);`,
			`for (const { pkg, leaf } of cases) {`,
			`	const r = out[pkg + "." + leaf];`,
			`	r.mounted = await b["mounted_" + pkg][leaf].next();`,
			`	r.bAfterMount = await b[pkg][leaf].next();`,
			`}`,
			`out.untypedesmIsModule = await a.untypedesm.counter.isModule();`,
			`await a.shutdown();`,
			`await b.shutdown();`,
			`process.stdout.write(JSON.stringify(out));`
		].join("\n");
		const scriptPath = path.join(root, "child.mjs");
		await fsp.writeFile(scriptPath, script, "utf8");
		const result = spawnSync(process.execPath, [scriptPath], { cwd: REPO_ROOT, env: process.env, encoding: "utf8", timeout: 90000 });
		expect(result.status, result.stderr).toBe(0);
		return JSON.parse(result.stdout);
	};

	for (const mode of MODES) {
		it(`${mode} mode: every case gets its own module scope per instance, reload and mount`, async () => {
			const out = await runNative(mode);
			for (const { label, pkg, leaf } of CASES) {
				expect(out[`${pkg}.${leaf}`], label).toEqual({
					a: [1, 2],
					b: [1],
					aAfterReload: 1,
					bAfterReload: 2,
					mounted: 1,
					bAfterMount: 3
				});
			}
			expect(out.untypedesmIsModule).toBe(true);
		}, 90000);
	}

	for (const [label, pkgJson] of [
		["malformed JSON", "{ not json"],
		["valid JSON that is not an object", "null\n"],
		["a JSON array", "[]\n"]
	]) {
		it(`a package.json holding ${label} is reported by Node's own loader`, async () => {
			root = await makeTestTmpDir("cjs-js-native-bad-pkg");
			const base = path.join(root, "api");
			await fsp.mkdir(base);
			await fsp.writeFile(path.join(base, "package.json"), pkgJson);
			await fsp.writeFile(path.join(base, "leaf.js"), "module.exports = { ok: () => true };\n");
			const script = [
				`import slothlet from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "index.mjs")).href)};`,
				`try {`,
				`	const api = await slothlet({ base: ${JSON.stringify(base)}, mode: "eager", silent: true });`,
				`	await api.shutdown();`,
				`	process.stdout.write("loaded");`,
				`} catch (error) {`,
				`	let e = error;`,
				`	while (e?.cause && !e.code?.startsWith("ERR_")) e = e.cause;`,
				`	process.stdout.write(String(e?.code));`,
				`}`
			].join("\n");
			const scriptPath = path.join(root, "child.mjs");
			await fsp.writeFile(scriptPath, script, "utf8");
			const result = spawnSync(process.execPath, [scriptPath], { cwd: REPO_ROOT, env: process.env, encoding: "utf8", timeout: 90000 });
			expect(result.status, result.stderr).toBe(0);
			expect(result.stdout).toBe("ERR_INVALID_PACKAGE_CONFIG");
		}, 90000);
	}
});
