/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/captured-prototype-methods-lint.test.vitest.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T03:00:00-08:00 (1794826800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The lint rule `slothlet/captured-prototype-methods` reports every call of a method a built-in value
 * inherits, and every `for…of`, spread, array destructuring and `yield*` that walks a value with its iterator, in
 * slothlet's own code; all of `src/` passes it with no exemptions.
 */

import path from "node:path";
import { describe, it, expect } from "vitest";
import { ESLint, Linter } from "eslint";
import globals from "globals";
import capturedIntrinsics from "../../../../tools/ci/eslint-captured-intrinsics.mjs";

const RULE = "slothlet/captured-prototype-methods";

const CONFIG = [
	{
		files: ["**/*.mjs"],
		languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node, ...globals.browser } },
		plugins: { slothlet: capturedIntrinsics },
		rules: { [RULE]: ["error", { safeIterators: ["framesOf"] }] }
	}
];

/**
 * Lint one snippet with the rule alone, inside a function (code at a file's top level runs before any module's code).
 * @param {string} body - The function's body.
 * @param {string} [head] - Code at the file's top level before the function.
 * @returns {string[]} The rule's message ids.
 */
function lint(body, head = "") {
	const code = `${head}\nexport function run(list, map, set, text, value, args, fn) {\n${body}\n}\n`;
	return new Linter({ configType: "flat" })
		.verify(code, CONFIG, "src/lib/x.mjs")
		.filter((m) => m.ruleId === RULE)
		.map((m) => m.messageId);
}

const IMPORTS =
	'import { ArrayMethods, MapMethods, mapEntries, setValues, listSteps, generatorSteps, Arrays } from "@cldmv/slothlet/helpers/intrinsics";\nimport path from "node:path";';

describe("slothlet/captured-prototype-methods", () => {
	it.each([
		["list.map((x) => x);", "method"],
		["list.push(1);", "method"],
		["map.get(1);", "method"],
		["set.has(1);", "method"],
		["text.startsWith('a');", "method"],
		["/a/.test(text);", "method"],
		["fn.call(null);", "method"],
		["value.hasOwnProperty('a');", "method"],
		["for (const x of list) x;", "forOf"],
		["const copy = [...list];", "spread"],
		["fn(...args);", "spread"],
		["const [a] = list;", "pattern"],
		["new Set(list);", "construct"],
		["Arrays.from(set);", "iterating"],
		["Promises.all(list);", "iterating"]
	])("reports %s", (body, id) => {
		expect(lint(body, IMPORTS)).toContain(id);
	});

	it("reports `yield*` over a value it does not know walks safely", () => {
		expect(lint("function* g() { yield* list; }", IMPORTS)).toContain("delegate");
	});

	it("leaves the copies taken at load, the safe walks and slothlet's own objects alone", () => {
		const body = [
			"ArrayMethods.push(list, 1);",
			"MapMethods.get(map, 1);",
			"for (const entry of mapEntries(map)) entry;",
			"for (const member of setValues(set)) member;",
			"for (const x of listSteps(list)) x;",
			"for (const frame of framesOf(list)) frame;",
			"function* g() { yield* generatorSteps(fn()); }",
			"const record = { has: () => true }; record.has(1);",
			"this.slothlet.handlers.ownership.get(1);",
			"path.join('a', 'b');",
			"const copy = { ...value };",
			"function rest(...all) { return all; }"
		].join("\n");
		expect(lint(body, `${IMPORTS}\nconst framesOf = (x) => x;`)).toEqual([]);
	});

	it("leaves code at a file's top level alone: no module's code has run yet", () => {
		const code = `${IMPORTS}\nconst names = new Set(["a"]);\nfor (const x of [1]) x;\n`;
		const messages = new Linter({ configType: "flat" }).verify(code, CONFIG, "src/lib/x.mjs").filter((m) => m.ruleId === RULE);
		expect(messages).toEqual([]);
	});

	it("finds nothing in src/, with every inline directive ignored", async () => {
		const eslint = new ESLint({
			cwd: process.cwd(),
			overrideConfigFile: true,
			overrideConfig: [{ linterOptions: { noInlineConfig: true } }, ...CONFIG.map((entry) => ({ ...entry, files: ["src/**/*.mjs"] }))]
		});
		const results = await eslint.lintFiles([path.join("src", "**", "*.mjs")]);
		const problems = results.flatMap((result) =>
			result.messages
				.filter((m) => m.ruleId === RULE || m.fatal)
				.map((m) => `${path.relative(process.cwd(), result.filePath)}:${m.line} ${m.message}`)
		);
		expect(problems).toEqual([]);
	}, 300000);
});
