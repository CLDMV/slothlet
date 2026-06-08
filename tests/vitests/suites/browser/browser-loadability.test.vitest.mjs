/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-loadability.test.vitest.mjs
 *	@Date: 2026-05-30 00:00:00 -07:00 (1748588400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:03 -07:00 (1780546683)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Static browser-loadability guard (issue #123).
 *
 * @description
 * The "browser-mode" runtime is correct, but it can only be reached if the module
 * graph a browser must parse is actually loadable. This test statically enforces
 * the two invariants that make the graph loadable in a raw ES-module context
 * (Electron renderer, <script type="module">, importmap — no bundler):
 *
 *   1. No top-level static `node:*` imports anywhere in the statically-reachable
 *      graph rooted at the `.` entry (`index.mjs`) and the slothlet class
 *      (`@cldmv/slothlet/slothlet`, dynamically imported by the entry). Browsers
 *      resolve every static import at module-graph-construction time, before any
 *      code runs, so a single top-level `import ... from "node:fs"` fails the whole
 *      graph regardless of `platform: "browser"`. Dynamic `await import("node:*")`
 *      is runtime-conditional and fine — it is intentionally NOT flagged here.
 *
 *   2. `index.mjs` must not touch the `process` global at top-level module eval
 *      (`process` is undefined in a browser → ReferenceError). `typeof process`
 *      guards are fine; an unguarded top-level `process.on(...)` is not.
 *
 * @module tests/vitests/suites/browser/browser-loadability
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as presolve } from "node:path";
import { parse } from "acorn";

const REPO_ROOT = presolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Parse a module file to an ESTree AST (with source locations).
 * @param {string} filePath
 * @returns {object}
 */
function parseModule(filePath) {
	return parse(readFileSync(filePath, "utf8"), { ecmaVersion: "latest", sourceType: "module", locations: true });
}

/**
 * Collect the static import/re-export specifiers (with line numbers) of a module.
 * Dynamic `import()` is an ImportExpression, not an ImportDeclaration, so it is
 * naturally excluded.
 * @param {object} ast
 * @returns {Array<{ spec: string, line: number }>}
 */
function staticImportSources(ast) {
	const out = [];
	for (const node of ast.body) {
		const isStaticImport =
			node.type === "ImportDeclaration" || (node.type === "ExportNamedDeclaration" && node.source) || node.type === "ExportAllDeclaration";
		if (isStaticImport && node.source && typeof node.source.value === "string") {
			out.push({ spec: node.source.value, line: node.loc.start.line });
		}
	}
	return out;
}

/**
 * Resolve an import specifier to an absolute file path, or flag it as node:* /
 * unresolvable. Relative specifiers resolve against the importer; bare specifiers
 * (including self-referencing `@cldmv/slothlet/*`) go through Node's resolver under
 * the active conditions (vitest runs with `--conditions=slothlet-dev` → src/).
 * @param {string} spec
 * @param {string} parentFile
 * @returns {{ node?: true, file?: string, unresolved?: string }}
 */
function resolveSpec(spec, parentFile) {
	if (spec.startsWith("node:")) return { node: true };
	if (spec.startsWith(".")) {
		const target = presolve(dirname(parentFile), spec);
		for (const cand of [target, `${target}.mjs`, presolve(target, "index.mjs")]) {
			try {
				readFileSync(cand);
				return { file: cand };
			} catch {
				/* try next candidate */
			}
		}
		return { unresolved: spec };
	}
	try {
		const url = import.meta.resolve(spec);
		if (url.startsWith("node:")) return { node: true };
		return { file: fileURLToPath(url) };
	} catch {
		return { unresolved: spec };
	}
}

/**
 * Walk the static import graph from the given roots and collect every top-level
 * `node:*` import. Only walks files inside the repo (excludes node_modules /
 * external deps — those are a consumer bundling concern, not slothlet's graph).
 *
 * A file the graph reaches but that fails to parse is NOT silently dropped: a parse
 * failure means the scan can't see that module's imports, which would let a top-level
 * `node:*` import (or a newer syntax the parser can't read) bypass the guard unnoticed.
 * Such files are returned in `parseFailures` so the test can fail loudly.
 * @param {string[]} rootFiles
 * @returns {{ violations: Array<{ file: string, spec: string, line: number }>, parseFailures: Array<{ file: string, error: string }> }}
 */
function collectNodeImports(rootFiles) {
	const seen = new Set();
	const violations = [];
	const parseFailures = [];
	const stack = [...rootFiles];
	while (stack.length) {
		const file = stack.pop();
		if (seen.has(file)) continue;
		seen.add(file);
		if (!file.startsWith(REPO_ROOT) || file.includes("/node_modules/")) continue;
		// JSON imports (e.g. the bundled default locale via `with { type: "json" }`) are data
		// leaves: no imports, no `node:*` / `process` usage, browser-safe by nature — and not
		// parseable as JS. Skip them rather than count them as parse failures.
		if (file.endsWith(".json")) continue;
		let ast;
		try {
			ast = parseModule(file);
		} catch (err) {
			parseFailures.push({ file: file.slice(REPO_ROOT.length + 1), error: err.message });
			continue;
		}
		for (const { spec, line } of staticImportSources(ast)) {
			const r = resolveSpec(spec, file);
			if (r.node) violations.push({ file: file.slice(REPO_ROOT.length + 1), spec, line });
			else if (r.file) stack.push(r.file);
			// unresolved (external/optional) specifiers are intentionally ignored
		}
	}
	return { violations, parseFailures };
}

describe("Browser loadability (#123)", () => {
	// The `.` entry dynamically imports the class; the class's *static* graph is what
	// the browser must parse once that dynamic import fires.
	const classFile = fileURLToPath(import.meta.resolve("@cldmv/slothlet/slothlet"));
	const indexFile = presolve(REPO_ROOT, "index.mjs");

	it("statically-reachable graph from the entry + class has no top-level node:* imports", () => {
		const { violations, parseFailures } = collectNodeImports([indexFile, classFile]);
		// Fail loudly if any reachable module couldn't be parsed — a silently-skipped file
		// could hide a top-level node:* import and bypass this guard (issue #123).
		const failed = parseFailures.map((p) => `${p.file} → ${p.error}`).sort();
		expect(failed, `Modules in the browser graph that failed to parse (scan cannot verify them):\n${failed.join("\n")}`).toEqual([]);
		const summary = violations.map((v) => `${v.file}:${v.line} → ${v.spec}`).sort();
		expect(summary, `Browser-blocking top-level node:* imports found:\n${summary.join("\n")}`).toEqual([]);
	});

	it("index.mjs does not call into `process` at top-level module eval", () => {
		const ast = parseModule(indexFile);
		const topLevelProcessCalls = ast.body
			.filter(
				(n) =>
					n.type === "ExpressionStatement" &&
					n.expression?.type === "CallExpression" &&
					n.expression.callee?.type === "MemberExpression" &&
					n.expression.callee.object?.type === "Identifier" &&
					n.expression.callee.object.name === "process"
			)
			.map((n) => `process.${n.expression.callee.property?.name} @ line ${n.loc.start.line}`);
		expect(topLevelProcessCalls, `Unguarded top-level process usage in index.mjs:\n${topLevelProcessCalls.join("\n")}`).toEqual([]);
	});
});
