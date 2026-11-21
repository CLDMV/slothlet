/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/captured-intrinsics-lint.test.vitest.mjs
 *	@Date: 2026-11-13T21:31:30-08:00 (1794634290)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:36:23-08:00 (1794951383)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The lint rule `slothlet/captured-intrinsics` reports every read of a built-in in slothlet's own code
 * that is not the copy `helpers/intrinsics` took when slothlet loaded, and all of `src/` passes it with no exemptions.
 */

import path from "node:path";
import { describe, it, expect } from "vitest";
import { ESLint, Linter } from "eslint";
import globals from "globals";
import capturedIntrinsics from "../../../../tools/ci/eslint-captured-intrinsics.mjs";

const CONFIG = [
	{
		files: ["**/*.mjs"],
		languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node, ...globals.browser } },
		plugins: { slothlet: capturedIntrinsics },
		rules: { "slothlet/captured-intrinsics": "error" }
	}
];

/**
 * Lint one snippet with the rule alone.
 * @param {string} code - The module's source.
 * @returns {string[]} The rule's messages, each prefixed with its line.
 */
function lint(code) {
	return new Linter({ configType: "flat" })
		.verify(code, CONFIG, "src/lib/x.mjs")
		.filter((m) => m.ruleId === "slothlet/captured-intrinsics")
		.map((m) => `${m.line}: ${m.message}`);
}

const IMPORT = 'import { Error, Dates, String, Processes } from "#helpers/intrinsics";\nconst value = 1;\n';

describe("slothlet/captured-intrinsics", () => {
	it.each([
		["String(value);", "`String`"],
		["Boolean(value);", "`Boolean`"],
		["Number(value);", "`Number`"],
		["BigInt(1);", "`BigInt`"],
		["Date.now();", "`Date`"],
		['new RegExp("a");', "`RegExp`"],
		['new Error("a");', "`Error`"],
		['new TypeError("a");', "`TypeError`"],
		['new RangeError("a");', "`RangeError`"],
		["queueMicrotask(run);", "`queueMicrotask`"],
		["structuredClone(value);", "`structuredClone`"],
		["new TextDecoder();", "`TextDecoder`"],
		["new TextEncoder();", "`TextEncoder`"],
		["setTimeout(run, 0);", "`setTimeout`"],
		['parseInt("1", 10);', "`parseInt`"],
		["isNaN(value);", "`isNaN`"],
		['encodeURIComponent("a");', "`encodeURIComponent`"],
		["new Uint8Array(1);", "`Uint8Array`"],
		["ArrayBuffer.isView(value);", "`ArrayBuffer`"],
		["new FinalizationRegistry(run);", "`FinalizationRegistry`"],
		["process.cwd();", "`process`"],
		['console.warn("a");', "`console`"],
		["someHostGlobal.read();", "`someHostGlobal`"]
	])("reports the global in %s", (code, name) => {
		const messages = lint(`${code}\n`);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages.some((message) => message.includes(name))).toBe(true);
	});

	it("leaves the captured copies, globalThis and the read-only globals alone", () => {
		expect(
			lint(
				IMPORT +
					"String(value);\nDates.now();\nnew Error('a');\nError.stackTraceLimit = Infinity;\nError.prepareStackTrace = undefined;\n" +
					"Processes.cwd();\nglobalThis.console.warn('a');\nconst x = [undefined, NaN, Infinity];\n"
			)
		).toEqual([]);
	});

	it("reports a replaceable member read off a captured constructor, under any local name", () => {
		expect(lint(IMPORT + "Error.captureStackTrace(this);\n")).toEqual([
			"3: `Error.captureStackTrace` reads a member module code can replace on the shared constructor. Use Errors.captureStackTrace."
		]);
		expect(
			lint('import { Error as Pristine, Date } from "#helpers/intrinsics";\nPristine.captureStackTrace(this);\nDate.now();\n')
		).toEqual([
			"2: `Error.captureStackTrace` reads a member module code can replace on the shared constructor. Use Errors.captureStackTrace.",
			"3: `Date.now` reads a member module code can replace on the shared constructor. Use Dates.now."
		]);
		expect(lint(IMPORT + "String.fromCharCode(65);\n")).toEqual([
			"3: `String.fromCharCode` reads a member module code can replace on the shared constructor. Use Strings.fromCharCode."
		]);
	});

	it("reports a member read off a captured constructor's prototype, at load or later, under any local name", () => {
		const PROTOTYPE = "reads a member module code can replace on the shared prototype.";
		const messages = lint(
			'import { Objects, Promise as P, Map, Functions, FunctionMethods } from "#helpers/intrinsics";\n' +
				"const then = P.prototype.then;\n" +
				"export const has = (value, key) => FunctionMethods.call(Objects.prototype.hasOwnProperty, value, key);\n" +
				"export const method = (name) => Map.prototype[name];\n" +
				"export const call = () => Functions.prototype.call;\n" +
				"export const tag = (value) => Object.prototype.toString.call(value);\n"
		);
		expect(messages.filter((message) => message.includes(PROTOTYPE))).toEqual([
			"2: `P.prototype.then` reads a member module code can replace on the shared prototype. Call the copy taken at load, `PromiseMethods.then(value, …)`, or take the function itself as `PrototypeFunctions.Promise.then`, from #helpers/intrinsics.",
			"3: `Objects.prototype.hasOwnProperty` reads a member module code can replace on the shared prototype. Call the copy taken at load, `ObjectMethods.hasOwnProperty(value, …)`, or take the function itself as `PrototypeFunctions.Object.hasOwnProperty`, from #helpers/intrinsics.",
			"4: `Map.prototype[name]` reads a member module code can replace on the shared prototype. Call the copy taken at load, `MapMethods.[…](value, …)`, or take the function itself as `PrototypeFunctions.Map.[…]`, from #helpers/intrinsics.",
			"5: `Functions.prototype.call` reads a member module code can replace on the shared prototype. Call the copy taken at load, `FunctionMethods.call(value, …)`, or take the function itself as `PrototypeFunctions.Function.call`, from #helpers/intrinsics."
		]);
		// The global `Object` is reported as a global.
		expect(messages.some((message) => message.startsWith("6: `Object` here is the global"))).toBe(true);
	});

	it("reports a captured constructor's prototype handed to a descriptor read, getPrototypeOf or a function of the file's own, at load or later", () => {
		const HANDED = "reads the shared prototype's members (or its prototype) when it runs";
		const messages = lint(
			'import { Reflect, Objects, RegExp, DataView, Uint8Array } from "#helpers/intrinsics";\n' +
				'const source = Reflect.getOwnPropertyDescriptor(RegExp.prototype, "source").get;\n' +
				"const getterOf = (prototype, key) => Objects.getOwnPropertyDescriptor(prototype, key).get;\n" +
				'export const length = () => getterOf(DataView.prototype, "byteLength");\n' +
				"const typed = Reflect.getPrototypeOf(Uint8Array.prototype);\n" +
				"function all(prototype) {\n\treturn Objects.getOwnPropertyDescriptors(prototype);\n}\n" +
				"all(RegExp.prototype);\n"
		);
		expect(messages.filter((message) => message.includes(HANDED)).map((message) => message.split(":")[0])).toEqual(["2", "4", "5", "9"]);
		expect(messages.find((message) => message.startsWith("4:"))).toContain("`PrototypeFunctions.DataView`");
	});

	it("leaves a prototype handed to an imported helper, a write and the descriptor read kept on purpose alone", () => {
		expect(
			lint(
				'import { Objects, Promise } from "#helpers/intrinsics";\nimport { holdsValue } from "#helpers/boundary-patch-layers";\n' +
					'export const then = () => Objects.getOwnPropertyDescriptor(Promise.prototype, "then");\n' +
					'export const held = (wrapper) => holdsValue(Promise.prototype, "then", wrapper);\n' +
					'export const write = (wrapper) => Objects.defineProperty(Promise.prototype, "then", { __proto__: null, value: wrapper });\n'
			)
		).toEqual([]);
	});

	it("leaves the prototype object itself, a write to its member and the reads kept on purpose alone", () => {
		expect(
			lint(
				'import { Objects, EventTarget, PrototypeFunctions, ObjectMethods } from "#helpers/intrinsics";\n' +
					"export const isPlain = (value) => Objects.getPrototypeOf(value) === Objects.prototype;\n" +
					"export function patch(fn) {\n\tconst below = EventTarget.prototype.addEventListener;\n\tEventTarget.prototype.addEventListener = fn;\n\treturn below;\n}\n" +
					"export const has = (value, key) => ObjectMethods.hasOwnProperty(value, key) && PrototypeFunctions.Object.valueOf !== value;\n"
			)
		).toEqual([]);
	});

	const NODE_MEMBER = "reads a member of a Node built-in module after slothlet loaded";
	const NODE_BINDING = "is a live binding of a Node built-in module";
	const PROCESSES = 'import { Processes, Objects } from "#helpers/intrinsics";\n';

	it.each([
		[
			"off what process.getBuiltinModule returns",
			'const fs = Processes.getBuiltinModule("node:fs");\nexport function read(file) {\n\treturn fs.readFileSync(file);\n}\n',
			4
		],
		[
			"off what a helper around it returns",
			'function nodeBuiltin(id) {\n\treturn Processes.getBuiltinModule(id);\n}\nexport function req(file) {\n\treturn nodeBuiltin("node:module").createRequire(file);\n}\n',
			6
		],
		[
			"through a destructuring",
			'export function req(file) {\n\tconst { createRequire } = Processes.getBuiltinModule("node:module");\n\treturn createRequire(file);\n}\n',
			3
		],
		["off an import()", 'export async function run() {\n\tconst { fork } = await import("child_process");\n\treturn fork;\n}\n', 3],
		[
			'off createRequire(…)("node:…")',
			'import { createRequire } from "x";\nexport function hooks() {\n\treturn createRequire(import.meta.url)("node:module").registerHooks;\n}\n',
			4
		],
		["off a default import", 'import fs from "node:fs";\nexport function read(file) {\n\treturn fs.readFileSync(file);\n}\n', 4],
		["off a namespace import", 'import * as nodePath from "path";\nexport const join = (a, b) => nodePath.join(a, b);\n', 3],
		[
			"off an object a built-in holds",
			'const util = Processes.getBuiltinModule("node:util");\nexport const isProxy = (value) => util.types.isProxy(value);\n',
			3
		],
		[
			"in a function also called after load",
			'const fs = Processes.getBuiltinModule("node:fs");\nfunction read(file) {\n\treturn fs.readFileSync(file);\n}\nread("a");\nexport const later = () => read("b");\n',
			4
		],
		[
			"in an exported function, even one the file calls at its top level",
			'const fs = Processes.getBuiltinModule("node:fs");\nexport function read(file) {\n\treturn fs.readFileSync(file);\n}\nread("a");\n',
			4
		],
		[
			"in an async function run on the spot",
			'const fs = Processes.getBuiltinModule("node:fs");\n(async () => {\n\tawait 0;\n\tfs.readFileSync("a");\n})();\n',
			5
		]
	])("reports a member of a Node built-in read %s", (_what, code, line) => {
		const messages = lint(PROCESSES + code);
		expect(messages.length).toBe(1);
		expect(messages[0]).toContain(NODE_MEMBER);
		expect(messages[0].startsWith(`${line}:`)).toBe(true);
	});

	it("reports a named import of a built-in used after load", () => {
		const messages = lint('import { readFileSync } from "node:fs";\nexport function read(file) {\n\treturn readFileSync(file);\n}\n');
		expect(messages).toEqual([
			`3: \`readFileSync\` ${NODE_BINDING}, which \`module.syncBuiltinESMExports()\` changes. Take it when the file loads (at its top level) and call that copy.`
		]);
	});

	it("leaves the reads made as the file loads, and the loader state slothlet patches on purpose, alone", () => {
		expect(
			lint(
				PROCESSES +
					'import * as nodeFs from "node:fs";\nimport { readFileSync as readNow } from "node:fs";\nimport { createRequire } from "x";\n' +
					"const copy = Objects.freeze({ ...nodeFs });\nconst text = readNow;\n" +
					'const { readFileSync } = Processes.getBuiltinModule("node:fs");\n' +
					'const HOST = (() => {\n\tconst fs = Processes.getBuiltinModule("node:fs");\n\treturn { exists: fs.existsSync };\n})();\n' +
					'function sample() {\n\treturn Processes.getBuiltinModule("node:util").inspect({});\n}\nsample();\n' +
					'const nodeModule = createRequire(import.meta.url)("node:module");\nconst load = nodeModule.Module;\n' +
					'const hooks = Processes.getBuiltinModule("node:async_hooks");\n' +
					"export function patchTargets() {\n\treturn [hooks.AsyncResource, hooks.AsyncLocalStorage, load._load, load._resolveFilename, load._cache];\n}\n" +
					"export const use = () => [copy.readFileSync, text, readFileSync, HOST.exists];\n"
			)
		).toEqual([]);
	});

	it("reports a comment that turns the rule off", () => {
		const off = "slothlet/captured-intrinsics has no exemptions: import the captured copy, or read the current global as `globalThis.X`.";
		expect(lint("// eslint-disable-next-line slothlet/captured-intrinsics -- the current one\nglobalThis.x = 1;\n")).toEqual([`1: ${off}`]);
		expect(lint("// eslint-disable-next-line no-console, slothlet/captured-intrinsics\nglobalThis.x = 1;\n")).toEqual([`1: ${off}`]);
		expect(lint("// eslint-disable-next-line\nglobalThis.x = 1;\n")).toEqual([`1: ${off}`]);
		expect(lint("// eslint-disable-next-line no-console -- unrelated\nglobalThis.x = 1;\n")).toEqual([]);
	});

	it("finds nothing in src/, with every inline directive ignored", async () => {
		const eslint = new ESLint({
			cwd: process.cwd(),
			overrideConfigFile: true,
			overrideConfig: [{ linterOptions: { noInlineConfig: true } }, ...CONFIG.map((entry) => ({ ...entry, files: ["src/**/*.mjs"] }))]
		});
		const results = await eslint.lintFiles([path.join("src", "**", "*.mjs")]);
		const problems = results.flatMap((result) =>
			result.messages.map((m) => `${path.relative(process.cwd(), result.filePath)}:${m.line} ${m.message}`)
		);
		expect(problems).toEqual([]);
	}, 300000);
});
