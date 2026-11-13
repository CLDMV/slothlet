/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/captured-builtins-child.test.vitest.mjs
 *	@Date: 2026-11-13T01:04:06-08:00 (1794560646)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T01:04:06-08:00 (1794560646)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet builds, adds to, reloads and shuts down an api, records the files it loads and makes its
 * errors with the built-ins it loaded with, whatever the globals hold by then.
 *
 * A child process (replacing the globals would disturb vitest itself) loads slothlet, then replaces the global
 * constructors `Map`, `Set`, `WeakMap`, `WeakSet`, `WeakRef`, `Promise`, `Symbol`, `Proxy`, `URL` and
 * `URLSearchParams` and every static function of `Object`, `Array`, `Reflect`, `JSON`, `Math`, `Promise` and
 * `Symbol` with functions that throw, and runs: building an instance (`slothlet.mjs`, `helpers/config`, `builders/`,
 * `modes/`, `processors/flatten` and `processors/loader`), a CommonJS file (`helpers/instance-imports`), a rule-denied
 * call (`errors.mjs`, `i18n/translations`), `api.slothlet.api.add` (`builders/api-assignment`,
 * `builders/modes-processor`), `api.slothlet.reload()`, a refused add and a refused config, and `shutdown()`. The
 * same probe with nothing replaced gives the expected answers.
 *
 * The probe builds and shuts down one instance before replacing anything: `index.mjs` loads slothlet's own files with
 * the first instance, and they take their copies when they load. Left in place: `Promise.resolve`, which
 * `Promise.all` and the other combinators read off the constructor themselves.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "captured-builtins-child");
const PROBE = path.join(ROOT, "probe.mjs");

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/math/math.mjs", ["export function add(a, b) {", "\treturn a + b;", "}"]);
	write("api/folder/folder.mjs", ["export function only() {", '\treturn "flattened";', "}"]);
	write("api/legacy/legacy.cjs", ["module.exports = {", "\tgreet(name) {", '\t\treturn "hi " + name;', "\t}", "};"]);
	write("api/guest/guest.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function tryMath() {",
		"\treturn self.math.add(1, 1);",
		"}"
	]);
	write("extra/mul.mjs", ["export function mul(a, b) {", "\treturn a * b;", "}"]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		"const [mode, runtime, attribution, replace] = process.argv.slice(2);",
		'const API = new URL("./api/", import.meta.url).pathname;',
		'const EXTRA = new URL("./extra/", import.meta.url).pathname;',
		"const saved = [];",
		"// Taken before anything is replaced: the probe itself runs on none of the replaced functions.",
		"const CONSTRUCTORS = ['Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Promise', 'Symbol', 'Proxy', 'URL', 'URLSearchParams'];",
		"const HOLDERS = [Object, Array, Reflect, JSON, Math, Promise, Symbol];",
		"// Promise.all and the others read Promise.resolve off the constructor themselves.",
		"const KEPT = [Promise.resolve];",
		"const statics = [];",
		"for (const holder of HOLDERS) {",
		"\tfor (const name of Object.getOwnPropertyNames(holder)) {",
		"\t\tconst d = Object.getOwnPropertyDescriptor(holder, name);",
		"\t\tif (typeof d.value === 'function' && d.writable && !KEPT.includes(d.value)) statics.push([holder, name]);",
		"\t}",
		"}",
		"const thrower = (name) => function () { throw new Error('replaced ' + name); };",
		"function replaceAll() {",
		"\tfor (const [holder, name] of statics) { saved.push([holder, name, holder[name]]); holder[name] = thrower(name); }",
		"\tfor (const name of CONSTRUCTORS) { saved.push([globalThis, name, globalThis[name]]); globalThis[name] = thrower(name); }",
		"}",
		"function restoreAll() {",
		"\tfor (let i = saved.length - 1; i >= 0; i--) saved[i][0][saved[i][1]] = saved[i][2];",
		"}",
		"const step = async (fn) => {",
		"\ttry {",
		"\t\treturn await fn();",
		"\t} catch (error) {",
		"\t\treturn error?.code ?? 'threw ' + error?.message;",
		"\t}",
		"};",
		"const out = {};",
		"// slothlet's own files load with the first instance (index.mjs imports them then): one built and shut down first.",
		"const warm = await slothlet({ dir: EXTRA, mode, runtime });",
		"await warm.shutdown();",
		"if (replace === 'yes') replaceAll();",
		"let api = null;",
		"out.built = await step(async () => {",
		"\tapi = await slothlet({",
		"\t\tdir: API, mode, runtime,",
		"\t\tpermissions: { defaultPolicy: 'allow', attribution, rules: [{ caller: 'guest.**', target: 'math.**', effect: 'deny' }] }",
		"\t});",
		"\treturn 'built';",
		"});",
		"if (api) {",
		"\tout.add = await step(() => api.math.add(2, 3));",
		"\tout.flatten = await step(() => api.folder.only());",
		"\tout.cjs = await step(() => api.legacy.greet('x'));",
		"\tout.denied = await step(() => api.guest.tryMath());",
		"\tout.added = await step(async () => {",
		"\t\tawait api.slothlet.api.add('extra', EXTRA);",
		"\t\treturn api.extra.mul(2, 3);",
		"\t});",
		"\tout.refusedAdd = await step(() => api.slothlet.api.add('slothlet', EXTRA));",
		"\tout.reloaded = await step(async () => {",
		"\t\tawait api.slothlet.reload();",
		"\t\treturn api.math.add(4, 5);",
		"\t});",
		"\tout.shutdown = await step(async () => {",
		"\t\tawait api.shutdown();",
		"\t\treturn 'done';",
		"\t});",
		"}",
		"out.refusedConfig = await step(() => slothlet({ dir: API + 'missing' }));",
		"restoreAll();",
		"process.stdout.write(JSON.stringify(out) + '\\n');",
		"process.exit(0);"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} args - mode, runtime, attribution, and whether to replace the built-ins.
 * @returns {object} What each step answered.
 */
function probe(args) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", PROBE, ...args], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const attribution of ["precise", "fast"]) CONFIGS.push({ mode, runtime, attribution });
	}
}

describe.each(CONFIGS)("built-ins replaced after slothlet loaded ($mode, $runtime, $attribution)", ({ mode, runtime, attribution }) => {
	it("answers every step as with nothing replaced", () => {
		const plain = probe([mode, runtime, attribution, "no"]);
		expect(plain).toMatchObject({
			built: "built",
			add: 5,
			flatten: "flattened",
			cjs: "hi x",
			denied: "PERMISSION_DENIED",
			added: 6,
			reloaded: 9,
			shutdown: "done",
			refusedAdd: "INVALID_CONFIG_API_PATH_INVALID",
			refusedConfig: "INVALID_DIRECTORY"
		});
		expect(probe([mode, runtime, attribution, "yes"])).toEqual(plain);
	});
});
