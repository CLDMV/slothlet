/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/rules/rule-coverage.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Rule Coverage Test - Validates every catalogued condition is documented in code.
 * @description Parses the traceability matrix in API-RULE-MAPPING.md and checks that each rule's
 * conditions (across all series: C## flatten, G## discovery, N## naming, O## collision, M## mutation,
 * V## versioning, T## routines, B## built-in) are marked in the corresponding source files, that each
 * marker references its Rule # (and F## where applicable), and that the structural invariants hold:
 *   INV-1 every catalogued condition ties to >= 1 rule (no orphaned code marker)
 *   INV-2 every F## ties to >= 1 rule
 *   INV-3 every rule has >= 1 condition OR >= 1 F##
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasSource, internalLibPath } from "../../setup/internal-resolve.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the mapping table from API-RULE-MAPPING.md
const mappingDocPath = join(__dirname, "../../../../docs/API-RULES/API-RULE-MAPPING.md");
const mappingDoc = readFileSync(mappingDocPath, "utf-8");

// All source files that carry `// Rule N (X##)` condition markers. Static scanning only makes sense
// against the SOURCE tree; when `src/` is stripped (post-build CI) the reads are skipped and the suite
// is `describe.skipIf(!hasSource)`-gated.
const MARKER_FILES = [
	"processors/flatten.mjs",
	"processors/loader.mjs",
	"helpers/module-discovery.mjs",
	"helpers/module-manifest-validator.mjs",
	"helpers/sanitize.mjs",
	"helpers/module-sort.mjs",
	"handlers/ownership.mjs",
	"builders/api-assignment.mjs",
	"handlers/module-manager.mjs",
	"handlers/api-manager.mjs",
	"handlers/version-manager.mjs",
	"handlers/routine-manager.mjs",
	"builders/api_builder.mjs",
	"builders/modes-processor.mjs",
	"helpers/generate-manifest.mjs"
];

const allImplementationCode = hasSource ? MARKER_FILES.map((f) => readFileSync(internalLibPath(f), "utf-8")).join("\n") : "";

// A condition token in any catalogued series.
const CONDITION_TOKEN = /\b[CGNOMVTB]\d{2}[a-z]?\b/g;

/**
 * Parse the traceability table from API-RULE-MAPPING.md.
 * @returns {Array<Object>} Array of { ruleNum, fPatterns, cConditions, ruleName }.
 */
function rule_coverage_parseMappingTable() {
	const lines = mappingDoc.split("\n");
	let tableStart = -1;
	let tableEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.startsWith("| Rule") && line.includes("| F##") && line.includes("| C##")) {
			tableStart = i + 2; // Skip header and separator
			break;
		}
	}

	if (tableStart === -1) {
		throw new Error("Could not find mapping table in API-RULE-MAPPING.md");
	}

	for (let i = tableStart; i < lines.length; i++) {
		if (!lines[i].trim().startsWith("|")) {
			tableEnd = i;
			break;
		}
	}
	if (tableEnd === -1) tableEnd = lines.length;

	const mappings = [];
	for (let i = tableStart; i < tableEnd; i++) {
		const cells = lines[i]
			.split("|")
			.map((c) => c.trim())
			.filter((c) => c);
		if (cells.length < 4) continue;

		const ruleLinkMatch = cells[0].match(/\[Rule\s+(\d+)\]/i);
		const ruleNum = ruleLinkMatch ? parseInt(ruleLinkMatch[1], 10) : parseInt(cells[0], 10);
		if (isNaN(ruleNum)) continue;

		const hasDescriptionColumn = cells.length >= 5;
		const fCell = hasDescriptionColumn ? cells[2] : cells[1];
		const cCell = hasDescriptionColumn ? cells[3] : cells[2];
		const ruleNameCell = hasDescriptionColumn ? cells[1] : cells[3];

		const fPatterns = (fCell.match(/\bF\d{2}[a-z]?\b/gi) || []).map((p) => p.toUpperCase());
		const cConditions = (cCell.match(CONDITION_TOKEN) || []).map((c) => c.toUpperCase());
		const ruleName = ruleNameCell.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();

		mappings.push({ ruleNum, fPatterns, cConditions, ruleName });
	}

	return mappings;
}

/**
 * Check if a condition token is documented in a code marker comment.
 * @param {string} condition - condition token (e.g. "C05", "G01", "O14")
 * @returns {boolean}
 */
function rule_coverage_isConditionDocumented(condition) {
	const patterns = [
		new RegExp(`\\b${condition}\\b\\s*[:)]`, "i"),
		new RegExp(`[\\(\\[]${condition}[\\)\\]]`, "i"),
		new RegExp(`//.*?\\b${condition}\\b`, "i")
	];
	return patterns.some((pattern) => pattern.test(allImplementationCode));
}

/**
 * Extract every condition token that appears on a marker line (a comment mentioning `Rule <num>`).
 * Scoping to marker lines avoids matching incidental tokens elsewhere in the source.
 * @returns {Array<string>} uppercase, unique tokens
 */
function rule_coverage_extractImplementedConditions() {
	const tokens = new Set();
	for (const line of allImplementationCode.split("\n")) {
		if (!/\bRule\s+\d+/i.test(line)) continue;
		for (const t of line.match(CONDITION_TOKEN) || []) tokens.add(t.toUpperCase());
	}
	return [...tokens];
}

/**
 * Check a Rule # is referenced near a condition token.
 * @param {number} ruleNum
 * @param {string} condition
 * @returns {boolean}
 */
function rule_coverage_hasRuleReference(ruleNum, condition) {
	const pattern = new RegExp(`\\b${condition}\\b`, "gi");
	let match;
	while ((match = pattern.exec(allImplementationCode)) !== null) {
		const context = allImplementationCode.substring(Math.max(0, match.index - 200), match.index + 50);
		if (new RegExp(`Rule\\s+${ruleNum}\\b`, "i").test(context)) return true;
	}
	return false;
}

/**
 * Check any of a rule's F## patterns is referenced near a condition token.
 * @param {Array<string>} fPatterns
 * @param {string} condition
 * @returns {boolean}
 */
function rule_coverage_hasFPatternReference(fPatterns, condition) {
	if (!fPatterns || fPatterns.length === 0) return true;
	const pattern = new RegExp(`\\b${condition}\\b`, "gi");
	let match;
	while ((match = pattern.exec(allImplementationCode)) !== null) {
		const context = allImplementationCode.substring(Math.max(0, match.index - 200), match.index + 50);
		if (fPatterns.some((f) => new RegExp(`\\b${f}\\b`, "i").test(context))) return true;
	}
	return false;
}

describe.skipIf(!hasSource)("Rule Coverage Validation", () => {
	const mappings = rule_coverage_parseMappingTable();
	const implementedConditions = rule_coverage_extractImplementedConditions();

	// Rules whose conditions live entirely in non-C## series (or are ownership-only) legitimately have
	// no C## entry. Every OTHER rule must map at least one condition.
	const NO_CONDITION_ALLOWED = new Set([]); // all 21 rules carry >= 1 condition in some series

	test("Mapping table parsed successfully (21 rules)", () => {
		expect(mappings.length).toBe(21);
	});

	test("INV-3: every rule has >= 1 condition OR >= 1 F##", () => {
		const empty = mappings.filter((m) => m.cConditions.length === 0 && m.fPatterns.length === 0).map((m) => m.ruleNum);
		expect(empty).toEqual([]);
	});

	test("INV-2: every F## (F01-F08) ties to >= 1 rule", () => {
		const mapped = new Set(mappings.flatMap((m) => m.fPatterns));
		const missing = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"].filter((f) => !mapped.has(f));
		expect(missing).toEqual([]);
	});

	test("All catalogued conditions are documented in code", () => {
		const expected = new Set(mappings.flatMap((m) => m.cConditions));
		const missing = [...expected].filter((c) => !rule_coverage_isConditionDocumented(c));
		expect(missing).toEqual([]);
	});

	test("INV-1: no orphaned condition markers (every code marker is mapped)", () => {
		const mapped = new Set(mappings.flatMap((m) => m.cConditions.map((c) => c.toUpperCase())));
		// C06 = deliberately unimplemented placeholder; C07 = Rule 2 fallback marker.
		const knownOrphans = new Set(["C06", "C07"]);
		const orphaned = implementedConditions.filter((c) => !mapped.has(c) && !knownOrphans.has(c));
		expect(orphaned).toEqual([]);
	});

	describe("Individual Rule Coverage", () => {
		for (const mapping of mappings) {
			if (mapping.cConditions.length === 0) {
				test(`Rule ${mapping.ruleNum}: ${mapping.ruleName} (no condition - via F## only)`, () => {
					expect(NO_CONDITION_ALLOWED.has(mapping.ruleNum) || mapping.fPatterns.length > 0).toBe(true);
				});
				continue;
			}

			describe(`Rule ${mapping.ruleNum}: ${mapping.ruleName}`, () => {
				for (const condition of mapping.cConditions) {
					test(`${condition} is documented in code`, () => {
						expect(rule_coverage_isConditionDocumented(condition)).toBe(true);
					});

					if (mapping.fPatterns.length > 0) {
						test(`${condition} references F## (${mapping.fPatterns.join(", ")})`, () => {
							expect(rule_coverage_hasFPatternReference(mapping.fPatterns, condition)).toBe(true);
						});
					}

					test(`${condition} references Rule ${mapping.ruleNum}`, () => {
						expect(rule_coverage_hasRuleReference(mapping.ruleNum, condition)).toBe(true);
					});
				}
			});
		}
	});

	test("Summary: all conditions accounted for", () => {
		const expected = new Set(mappings.flatMap((m) => m.cConditions));
		expect(implementedConditions.length).toBeGreaterThanOrEqual(expected.size);
	});
});
