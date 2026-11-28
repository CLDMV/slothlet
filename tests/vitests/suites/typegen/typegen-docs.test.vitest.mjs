/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/typegen/typegen-docs.test.vitest.mjs
 *	@Date: 2026-11-25T11:00:00-08:00 (1795633200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:07-08:00 (1795869187)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Typegen's `docs` option (`includeDocumentation`) carries each leaf's JSDoc onto its member (#994).
 *
 * With docs on (the default), every generated member whose export carries JSDoc gets that JSDoc's description and its
 * `@param`, `@returns`, `@deprecated` and `@example` tags, and TypeScript reads them back from the generated
 * interface. With `docs: false` the declaration has no copied comments and the same types.
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { generate } from "@cldmv/slothlet/typegen";
import { formatDocLines } from "#processors/type-docs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

// The compile check builds a full TypeScript program over slothlet's own declarations.
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

const tempRoots = [];

afterAll(async () => {
	await Promise.allSettled(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
});

/**
 * The fixture api: a root function, named / default / class / CommonJS / callable-namespace leaves, a nested folder,
 * an aliased re-export, and leaves with no JSDoc or only tags that are not carried.
 * @type {Record<string, string>}
 */
const FILES = {
	"root.mjs": `/**
 * Echo the input through the api root.
 * @param {string} input - Text to echo.
 * @returns {string} The echoed text.
 */
export default function root(input) {
	return input;
}
`,
	"math.mjs": `/**
 * @fileoverview Math helpers.
 * @module fixture.math
 */

/**
 * Add two numbers.
 * @param {number} a - First addend.
 * @param {{ round: boolean }} [b] - Second addend.
 * @returns {number} The sum.
 * @public
 */
export function add(a, b) {
	return a + b;
}

/**
 * Subtract two numbers.
 * @deprecated Use \`add\` with a negative number.
 * @example
 * // a glob like src/**\\/x stays escaped
 * math.sub(3, 1); // 2
 */
export const sub = (a, b) => a - b;

export function bare(value) {
	return value;
}

/** @internal */
export function hidden() {
	return 1;
}

/**
 * Multiply two numbers (re-exported under another name).
 * @param {number} a - First factor.
 */
function times(a, b) {
	const pattern = /{[}]/g;
	const text = \`\${a} } \${"{"}\`;
	return a * b + (pattern.test(text) ? 0 : 0);
}

export { times as mul };
`,
	"fns/greet.mjs": `/**
 * Greet someone by name.
 * @param {string} name - Who to greet.
 * @returns {string} The greeting.
 */
export default async function greet(name) {
	return \`Hello, \${name}\`;
}
`,
	"fns/parity.cjs": `/**
 * Whether a number is even.
 * @param {number} n - Number to test.
 * @returns {boolean} True when even.
 */
module.exports = function parity(n) {
	return n % 2 === 0;
};
`,
	"fns/logger.mjs": `/**
 * Log a message.
 * @param {string} message - Message to log.
 */
export default function logger(message) {
	return message;
}

/**
 * Log an informational message.
 * @param {string} message - Message to log.
 */
export function info(message) {
	return message;
}
`,
	"shapes/circle.mjs": `/**
 * A circle.
 * @example
 * new Circle(2).area();
 */
export default class Circle {
	constructor(radius) {
		this.radius = radius;
	}
	area() {
		return Math.PI * this.radius * this.radius;
	}
}
`,
	"shapes/area.mjs": `/**
 * Area of a square.
 * @param {number} side - Side length.
 * @returns {number} The area.
 */
export function square(side) {
	return side * side;
}
`
};

/**
 * Write the fixture api into a fresh scratch directory inside the package (so `@cldmv/slothlet` self-resolves).
 * @returns {Promise<{root: string, base: string}>} The scratch root and its api folder.
 */
async function writeFixture() {
	const root = await makeTestTmpDir("typegen-docs");
	tempRoots.push(root);
	const base = path.join(root, "api");
	for (const [file, text] of Object.entries(FILES)) {
		await mkdir(path.dirname(path.join(base, file)), { recursive: true });
		await writeFile(path.join(base, file), text, "utf8");
	}
	return { root, base };
}

/**
 * The declaration without its timestamp line, so two runs compare equal.
 * @param {string} content - Generated declaration.
 * @returns {string} The content without `@generated`.
 */
const stable = (content) => content.replace(/^ \* @generated .*\n/m, "");

/**
 * The declaration's lines outside JSDoc blocks, ignoring the root function's own note (which docs merge into one
 * block with the root's JSDoc).
 * @param {string} content - Generated declaration.
 * @returns {string[]} Code lines.
 */
function codeLines(content) {
	const out = [];
	let inBlock = false;
	for (const line of stable(content).split("\n")) {
		const trimmed = line.trim();
		if (!inBlock && trimmed.startsWith("/**") && !trimmed.endsWith("*/")) {
			inBlock = true;
			continue;
		}
		if (inBlock) {
			if (trimmed === "*/") inBlock = false;
			continue;
		}
		if (trimmed.startsWith("/**") && trimmed.endsWith("*/")) continue;
		out.push(line);
	}
	return out;
}

describe("typegen docs option (#994)", () => {
	it("copies each leaf's JSDoc onto its generated member by default", async () => {
		const { root, base } = await writeFixture();
		const { content } = await generate({ base, output: path.join(root, "types", "api.d.mts"), name: "DocsApi" });

		// Named function: description and tags, with the {type} expressions dropped and visibility tags left out.
		expect(content).toContain(
			[
				"\t\t/**",
				"\t\t * Add two numbers.",
				"\t\t * @param a - First addend.",
				"\t\t * @param [b] - Second addend.",
				"\t\t * @returns The sum.",
				"\t\t */",
				"\t\tadd: typeof import("
			].join("\n")
		);
		expect(content).not.toContain("@public");
		expect(content).not.toContain("{number}");

		// Arrow-function const: @deprecated and a multi-line @example, its escaped `*\/` still escaped.
		expect(content).toContain(
			[
				"\t\t/**",
				"\t\t * Subtract two numbers.",
				"\t\t * @deprecated Use `add` with a negative number.",
				"\t\t * @example",
				"\t\t * // a glob like src/**\\/x stays escaped",
				"\t\t * math.sub(3, 1); // 2",
				"\t\t */",
				"\t\tsub: typeof import("
			].join("\n")
		);

		// No JSDoc, or only tags that are not carried: no comment at all.
		expect(content).toContain("\n\t\tbare: typeof import(");
		expect(content).not.toMatch(/\*\/\n\t\tbare:/);
		expect(content).not.toMatch(/\*\/\n\t\thidden:/);
		expect(content).not.toContain("@internal");
		expect(content).not.toContain("@fileoverview");

		// A re-export alias (`export { times as mul }`) finds the binding's JSDoc; a regex and a template holding braces
		// before it do not throw the scan off.
		expect(content).toContain(
			"\t\t * Multiply two numbers (re-exported under another name).\n\t\t * @param a - First factor.\n\t\t */\n\t\tmul:"
		);

		// Default export, CommonJS module.exports function, callable namespace and its merged member.
		expect(content).toContain(
			"\t\t * Greet someone by name.\n\t\t * @param name - Who to greet.\n\t\t * @returns The greeting.\n\t\t */\n\t\tgreet:"
		);
		expect(content).toContain(
			"\t\t * Whether a number is even.\n\t\t * @param n - Number to test.\n\t\t * @returns True when even.\n\t\t */\n\t\tparity:"
		);
		expect(content).toContain("\t\t * Log a message.\n\t\t * @param message - Message to log.\n\t\t */\n\t\tlogger:");
		expect(content).toContain("\t\t\t * Log an informational message.\n\t\t\t * @param message - Message to log.\n\t\t\t */\n\t\t\tinfo:");

		// Nested folder members: a default class and a named function.
		expect(content).toContain("\t\t * A circle.\n\t\t * @example\n\t\t * new Circle(2).area();\n\t\t */\n\t\tCircle:");
		expect(content).toContain(
			"\t\t\t * Area of a square.\n\t\t\t * @param side - Side length.\n\t\t\t * @returns The area.\n\t\t\t */\n\t\t\tsquare:"
		);

		// The root function's call signature carries the root file's JSDoc, followed by the generator's note.
		expect(content).toContain(
			[
				"\t/**",
				"\t * Echo the input through the api root.",
				"\t * @param input - Text to echo.",
				"\t * @returns The echoed text.",
				"\t *",
				"\t * The api root's own function (`api()`, and `self()` in a leaf).",
				"\t */",
				"\t(...args: Parameters<"
			].join("\n")
		);
	});

	it("leaves the copied comments out with docs: false and changes no type", async () => {
		const { root, base } = await writeFixture();
		const on = await generate({ base, output: path.join(root, "types", "on.d.mts"), name: "DocsApi" });
		const off = await generate({ base, output: path.join(root, "types", "off.d.mts"), name: "DocsApi", docs: false });

		for (const text of ["Add two numbers.", "Greet someone by name.", "A circle.", "@param", "@returns", "@deprecated", "@example"]) {
			expect(off.content).not.toContain(text);
		}
		// The root note keeps its one-line form.
		expect(off.content).toContain("\t/** The api root's own function (`api()`, and `self()` in a leaf). */\n");
		expect(codeLines(off.content)).toEqual(codeLines(on.content));
	});

	it("compiles, and TypeScript reads the copied JSDoc from the generated interface", async () => {
		const { root, base } = await writeFixture();
		const output = path.join(root, "types", "api.d.mts");
		await generate({ base, output, name: "DocsApi" });
		const probe = path.join(root, "probe.mts");
		await writeFile(
			probe,
			`import { self } from "@cldmv/slothlet/runtime";
export function use() {
	const sum: number = self.math.add(1, { round: true });
	const echoed: string = self("x");
	const even: boolean = self.fns.parity(2);
	const area: number = self.shapes.area.square(2);
	return { sum, echoed, even, area };
}
`,
			"utf8"
		);

		const program = ts.createProgram([output, probe], {
			noEmit: true,
			strict: true,
			allowJs: true,
			skipLibCheck: false,
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			customConditions: ["slothlet-dev"],
			types: ["node"]
		});
		const diagnostics = ts
			.getPreEmitDiagnostics(program)
			.filter((d) => !d.file || !d.file.fileName.includes(`${path.sep}node_modules${path.sep}`))
			.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
		expect(diagnostics).toEqual([]);

		const checker = program.getTypeChecker();
		const source = program.getSourceFile(output);
		const iface = source.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === "DocsApi");
		const apiType = checker.getTypeAtLocation(iface);
		const member = (type, name) => checker.getPropertyOfType(type, name);
		const typeOf = (symbol) => checker.getTypeOfSymbolAtLocation(symbol, iface);

		const add = member(typeOf(member(apiType, "math")), "add");
		expect(ts.displayPartsToString(add.getDocumentationComment(checker))).toBe("Add two numbers.");
		expect(add.getJsDocTags(checker).map((tag) => tag.name)).toEqual(["param", "param", "returns"]);

		const sub = member(typeOf(member(apiType, "math")), "sub");
		expect(sub.getJsDocTags(checker).map((tag) => tag.name)).toContain("deprecated");

		const square = member(typeOf(member(typeOf(member(apiType, "shapes")), "area")), "square");
		expect(ts.displayPartsToString(square.getDocumentationComment(checker))).toBe("Area of a square.");
	});

	it("escapes a comment terminator in carried text and drops a block with nothing to carry", () => {
		expect(formatDocLines("*\n * Ends here */ not really.\n * @example\n * a */ b\n ")).toEqual([
			"Ends here *\\/ not really.",
			"@example",
			"a *\\/ b"
		]);
		expect(formatDocLines("* @type {string} ")).toBeNull();
		expect(formatDocLines("*\n * @returns {{ a: { b: number } }} Nested type.\n ")).toEqual(["@returns Nested type."]);
	});
});
