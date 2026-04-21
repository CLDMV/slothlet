/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/coverage/detailed-coverage-report.mjs
 *	@Date: 2026-04-18 23:32:25 -07:00 (1776580345)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-19 01:04:25 -07:00 (1776585865)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @Project: @cldmv/slothlet
 * @Filename: /tools/coverage/detailed-coverage-report.mjs
 * @Description: Detailed report showing contextual code blocks for uncovered statements in V8 coverage.
 */

import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import { walk } from "estree-walker";
import chalk from "chalk";

const COVERAGE_FILE = "./coverage/coverage-final.json";

/**
 * Resolves the absolute path of a file relative to the project root.
 * @param {string} filePath - The path to resolve.
 * @returns {string} The absolute path.
 */
function resolvePath(filePath) {
	return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

// Node types that are semantically meaningful containers
const SEMANTIC_TYPES = new Set([
	"IfStatement",
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
	"WhileStatement",
	"DoWhileStatement",
	"ForStatement",
	"ForInStatement",
	"ForOfStatement",
	"SwitchStatement",
	"TryStatement",
	"ClassDeclaration",
	"ClassExpression"
]);

// Node types too granular or structural to be useful as context containers
const SKIP_TYPES = new Set([
	"Program",
	"Identifier",
	"Literal",
	"PrivateIdentifier",
	"MemberExpression",
	"CallExpression",
	"NewExpression",
	"BinaryExpression",
	"LogicalExpression",
	"UnaryExpression",
	"SequenceExpression",
	"TemplateLiteral",
	"TemplateElement",
	"Property",
	"SpreadElement",
	"RestElement",
	"AssignmentPattern",
	"VariableDeclarator",
	"BlockStatement"
]);

/**
 * Finds the most semantically meaningful context range for a target line using AST analysis.
 * Prefers semantic containers (IfStatement, FunctionDeclaration, etc.) over structural ones.
 * If the best candidate exceeds 30 lines, tries going one level deeper.
 * Falls back to a ±10 line clip if nothing fits within 30 lines.
 * @param {string} source - The full source text of the file.
 * @param {number} targetLine - The 1-indexed line number to find context for.
 * @param {number} totalLines - Total number of lines in the file.
 * @returns {{start: number, end: number}} The context range (1-indexed, inclusive).
 */
function getContextRange(source, targetLine, totalLines) {
	const fallback = {
		start: Math.max(1, targetLine - 10),
		end: Math.min(totalLines, targetLine + 10)
	};

	let ast;
	try {
		ast = acorn.parse(source, { ecmaVersion: "latest", locations: true, sourceType: "module" });
	} catch {
		try {
			ast = acorn.parse(source, { ecmaVersion: "latest", locations: true, sourceType: "script" });
		} catch {
			return fallback;
		}
	}

	// Collect every AST node that fully contains targetLine
	const candidates = [];
	walk(ast, {
		enter(node) {
			if (!node.loc) return;
			const s = node.loc.start.line;
			const e = node.loc.end.line;
			if (s <= targetLine && e >= targetLine) {
				candidates.push({ type: node.type, start: s, end: e, size: e - s + 1 });
			}
		}
	});
	// Sort largest-first so we prefer the outermost meaningful context
	candidates.sort((a, b) => b.size - a.size);

	// Find the largest semantic container that still fits within 30 lines.
	// "else if" branches are nested IfStatements — sorting largest-first naturally
	// selects the outermost if/else chain over an inner else-if clause.
	for (const c of candidates) {
		if (SKIP_TYPES.has(c.type)) continue;
		if (!SEMANTIC_TYPES.has(c.type)) continue;
		if (c.size <= 30) return { start: c.start, end: c.end };
	}

	// Every semantic container was > 30 lines — try the largest non-skip candidate ≤ 30
	for (const c of candidates) {
		if (SKIP_TYPES.has(c.type)) continue;
		if (c.size <= 30) return { start: c.start, end: c.end };
	}

	return fallback;
}

async function generateReport() {
	if (!fs.existsSync(COVERAGE_FILE)) {
		console.error(`Error: Coverage file not found at ${COVERAGE_FILE}`);
		process.exit(1);
	}

	const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, "utf8"));
	let totalIssues = 0;

	console.log("🔍 Generating Detailed Coverage Report...\n");

	for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
		const absolutePath = resolvePath(filePath);
		if (!fs.existsSync(absolutePath)) continue;

		const source = fs.readFileSync(absolutePath, "utf8");
		const lines = source.split(/\r?\n/);
		const statements = fileCoverage.s; // Statement coverage counts
		const statementMap = fileCoverage.statementMap; // Mapping ID -> location
		let fileIssuesFound = 0;

		for (const [id, count] of Object.entries(statements)) {
			if (count === 0 && statementMap[id]) {
				const lineNumber = statementMap[id].start.line;
				fileIssuesFound++;
				totalIssues++;

				const range = getContextRange(source, lineNumber, lines.length);

				console.log(`📄 File: ${filePath}`);
				console.log(`📍 Issue at line: ${lineNumber}`);
				console.log(`📦 Container: Lines ${range.start} - ${range.end}`);
				console.log("--------------------------------------------------");

				for (let i = range.start - 1; i < range.end; i++) {
					const lineContent = lines[i];
					const prefix = i + 1 === lineNumber ? "👉 " : "   ";
					const marker = i + 1 === lineNumber ? chalk.bgRed.white.bold(" [UNCOVERED] ") : "";
					console.log(`${prefix}${i + 1}: ${lineContent}${marker}`);
				}
				console.log("--------------------------------------------------\n");
			}
		}

		if (fileIssuesFound > 0) {
			console.log(`✅ Found ${fileIssuesFound} issues in ${path.basename(filePath)}\n`);
		}
	}

	if (totalIssues === 0) {
		console.log("✨ All clear! No uncovered statements found.");
	} else {
		console.log(`❌ Report complete. Total uncovered statements identified: ${totalIssues}`);
	}
}

generateReport().catch((err) => {
	console.error("Report generation failed:", err);
	process.exit(1);
});
