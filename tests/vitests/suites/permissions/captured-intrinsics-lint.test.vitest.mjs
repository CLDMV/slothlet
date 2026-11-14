/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/captured-intrinsics-lint.test.vitest.mjs
 *	@Date: 2026-11-13T21:31:30-08:00 (1794634290)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:50:06-08:00 (1794635406)
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

const IMPORT = 'import { Error, Dates, String, Processes } from "@cldmv/slothlet/helpers/intrinsics";\nconst value = 1;\n';

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
			lint(
				'import { Error as Pristine, Date } from "@cldmv/slothlet/helpers/intrinsics";\nPristine.captureStackTrace(this);\nDate.now();\n'
			)
		).toEqual([
			"2: `Error.captureStackTrace` reads a member module code can replace on the shared constructor. Use Errors.captureStackTrace.",
			"3: `Date.now` reads a member module code can replace on the shared constructor. Use Dates.now."
		]);
		expect(lint(IMPORT + "String.fromCharCode(65);\n")).toEqual([
			"3: `String.fromCharCode` reads a member module code can replace on the shared constructor. Use Strings.fromCharCode."
		]);
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
