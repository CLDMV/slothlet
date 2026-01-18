/**
 * @fileoverview Rule Coverage Test - Validates all C## conditions are documented in code
 * @description Ensures flatten.mjs implementation references Rule #, F##, and C## properly
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the mapping table from API-RULE-MAPPING.md
const mappingDocPath = join(__dirname, "../../docs/API-RULE-MAPPING.md");
const mappingDoc = readFileSync(mappingDocPath, "utf-8");

// Read the implementation file
const flattenPath = join(__dirname, "../../src3/lib/helpers/flatten.mjs");
const flattenCode = readFileSync(flattenPath, "utf-8");

/**
 * Parse the mapping table from RULE-MAPPING.md
 * @returns {Array<Object>} Array of rule mappings
 */
function rule_coverage_parseMappingTable() {
	// Find the table by looking for header row followed by separator row
	const lines = mappingDoc.split("\n");
	let tableStart = -1;
	let tableEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.startsWith("| Rule #") && line.includes("| F##") && line.includes("| C##")) {
			tableStart = i + 2; // Skip header and separator
			break;
		}
	}

	if (tableStart === -1) {
		console.error("Available lines around table area:");
		console.error(lines.slice(25, 35).join("\n"));
		throw new Error("Could not find mapping table in API-RULE-MAPPING.md");
	}

	// Find table end (first empty line or non-table line after start)
	for (let i = tableStart; i < lines.length; i++) {
		if (!lines[i].trim().startsWith("|")) {
			tableEnd = i;
			break;
		}
	}

	if (tableEnd === -1) tableEnd = lines.length;

	const mappings = [];

	for (let i = tableStart; i < tableEnd; i++) {
		const line = lines[i];
		const cells = line
			.split("|")
			.map((c) => c.trim())
			.filter((c) => c);

		if (cells.length < 4) continue;

		const ruleNum = parseInt(cells[0], 10);
		if (isNaN(ruleNum)) continue;

		const fPatterns = cells[1]
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p && p !== "-");
		const cConditions = cells[2]
			.split(",")
			.map((c) => c.trim())
			.filter((c) => c && c !== "-");
		const ruleName = cells[3];

		mappings.push({
			ruleNum,
			fPatterns,
			cConditions,
			ruleName
		});
	}

	return mappings;
}

/**
 * Check if a C## condition is documented in the code
 * @param {string} condition - C## pattern (e.g., "C05")
 * @returns {boolean} True if found
 */
function rule_coverage_isConditionDocumented(condition) {
	// Look for condition in comments with flexible format
	const patterns = [
		// Standard format: C##: Description
		new RegExp(`\\b${condition}\\b.*?:`, "i"),
		// Alternative: (C##) or [C##]
		new RegExp(`[\\(\\[]${condition}[\\)\\]]`, "i"),
		// In comment: // C##
		new RegExp(`//.*?\\b${condition}\\b`, "i")
	];

	return patterns.some((pattern) => pattern.test(flattenCode));
}

/**
 * Extract all C## references from flatten.mjs
 * @returns {Array<string>} Array of C## patterns found (uppercase, unique)
 */
function rule_coverage_extractImplementedConditions() {
	const conditionPattern = /\bC\d{2}[a-z]?\b/gi;
	const matches = flattenCode.match(conditionPattern) || [];
	// Normalize to uppercase immediately to avoid duplicates
	return [...new Set(matches.map((m) => m.toUpperCase()))];
}

/**
 * Check if Rule # is referenced near a C## condition
 * @param {number} ruleNum - Rule number
 * @param {string} condition - C## pattern
 * @returns {boolean} True if rule number found near condition
 */
function rule_coverage_hasRuleReference(ruleNum, condition) {
	// Find ALL occurrences of this condition in the code
	const pattern = new RegExp(`\\b${condition}\\b`, "gi");
	let match;
	const occurrences = [];

	while ((match = pattern.exec(flattenCode)) !== null) {
		const contextStart = Math.max(0, match.index - 200);
		const contextEnd = Math.min(flattenCode.length, match.index + 50);
		occurrences.push(flattenCode.substring(contextStart, contextEnd));
	}

	// Check if ANY occurrence has the Rule # reference
	return occurrences.some((context) => new RegExp(`Rule\\s+${ruleNum}\\b`, "i").test(context));
}

/**
 * Check if F## pattern is referenced near a C## condition
 * @param {Array<string>} fPatterns - F## patterns (e.g., ["F01", "F02"])
 * @param {string} condition - C## pattern
 * @returns {boolean} True if any F## pattern found near condition
 */
function rule_coverage_hasFPatternReference(fPatterns, condition) {
	if (!fPatterns || fPatterns.length === 0) return true; // No F## required

	// Find ALL occurrences of this condition in the code
	const pattern = new RegExp(`\\b${condition}\\b`, "gi");
	let match;
	const occurrences = [];

	while ((match = pattern.exec(flattenCode)) !== null) {
		const contextStart = Math.max(0, match.index - 200);
		const contextEnd = Math.min(flattenCode.length, match.index + 50);
		occurrences.push(flattenCode.substring(contextStart, contextEnd));
	}

	// Check if ANY occurrence has ANY of the F## patterns
	return occurrences.some((context) => fPatterns.some((pattern) => new RegExp(`\\b${pattern}\\b`, "i").test(context)));
}

describe("Rule Coverage Validation", () => {
	const mappings = rule_coverage_parseMappingTable();
	const implementedConditions = rule_coverage_extractImplementedConditions();

	test("Mapping table parsed successfully", () => {
		expect(mappings.length).toBeGreaterThan(0);
		expect(mappings.length).toBe(12); // Should have 12 rules
	});

	test("All expected C## conditions exist in flatten.mjs", () => {
		const allExpectedConditions = new Set();
		for (const mapping of mappings) {
			for (const condition of mapping.cConditions) {
				allExpectedConditions.add(condition);
			}
		}

		const missing = [];
		for (const condition of allExpectedConditions) {
			if (!rule_coverage_isConditionDocumented(condition)) {
				missing.push(condition);
			}
		}

		expect(missing).toEqual([]);
	});

	test("No orphaned C## conditions in flatten.mjs", () => {
		const allExpectedConditions = new Set();
		for (const mapping of mappings) {
			for (const condition of mapping.cConditions) {
				allExpectedConditions.add(condition.toUpperCase()); // Normalize to uppercase
			}
		}

		const orphaned = implementedConditions.filter((c) => !allExpectedConditions.has(c));

		expect(orphaned).toEqual([]);
	});

	describe("Individual Rule Coverage", () => {
		for (const mapping of mappings) {
			if (mapping.cConditions.length === 0) {
				test(`Rule ${mapping.ruleNum}: ${mapping.ruleName} (no C## conditions - runtime only)`, () => {
					// Rules 11 and 12 are runtime-only, no C## conditions
					expect([11, 12]).toContain(mapping.ruleNum);
				});
				continue;
			}

			describe(`Rule ${mapping.ruleNum}: ${mapping.ruleName}`, () => {
				for (const condition of mapping.cConditions) {
					test(`${condition} is documented in code`, () => {
						expect(rule_coverage_isConditionDocumented(condition)).toBe(true);
					});

					if (mapping.fPatterns.length > 0) {
						test(`${condition} references F## pattern (${mapping.fPatterns.join(", ")})`, () => {
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

	test("Summary: All conditions accounted for", () => {
		// Count UNIQUE conditions across all rules (some conditions appear in multiple rules)
		const allConditions = new Set();
		for (const mapping of mappings) {
			for (const condition of mapping.cConditions) {
				allConditions.add(condition.toUpperCase());
			}
		}
		const expectedCount = allConditions.size;
		const documentedCount = implementedConditions.length;

		console.log(`\n📊 Rule Coverage Summary:`);
		console.log(`   Expected C## conditions: ${expectedCount}`);
		console.log(`   Documented C## conditions: ${documentedCount}`);
		console.log(`   Rules mapped: ${mappings.length}`);

		expect(documentedCount).toBeGreaterThanOrEqual(expectedCount);
	});
});
