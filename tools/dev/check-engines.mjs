/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/check-engines.mjs
 *	@Date: 2026-04-27 00:00:00 -07:00 (1745740800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-27 00:00:00 -07:00 (1745740800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Reads node_modules and reports which installed packages declare
 * an `engines.node` requirement that is incompatible with a given Node version.
 *
 * Usage:
 *   node tools/dev/check-engines.mjs            # defaults to current Node version
 *   node tools/dev/check-engines.mjs 16.20.2    # check against a specific version
 *   node tools/dev/check-engines.mjs 18          # check against Node 18
 *
 * Reports only DIRECT devDependencies and their offending transitive packages,
 * so you can see which top-level dep is responsible for each violation.
 *
 * @example
 * node tools/dev/check-engines.mjs 16.20.2
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const nodeModulesDir = path.join(projectRoot, "node_modules");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

/**
 * Parse a Node version string like "16.20.2" or "16" into a [major, minor, patch] tuple.
 * Pre-release/build suffixes (e.g. "-rc.1", "+build.1") are ignored, and extra
 * dot-separated segments beyond the first three are discarded.
 *
 * @param {string} versionStr - A version string.
 * @returns {[number, number, number]} The parsed [major, minor, patch] tuple.
 * @example
 * parseVersion("16.20.2");    // [16, 20, 2]
 * parseVersion("18");         // [18, 0, 0]
 * parseVersion("20.0.0-rc.1"); // [20, 0, 0]
 */
function parseVersion(versionStr) {
	const clean = versionStr
		.replace(/^v/, "")
		.replace(/[-+].*$/, "")
		.split(".")
		.slice(0, 3)
		.map((part) => {
			const value = Number(part);
			return Number.isFinite(value) ? value : 0;
		});
	return [clean[0] ?? 0, clean[1] ?? 0, clean[2] ?? 0];
}

/**
 * Compare two [major, minor, patch] tuples.
 *
 * @param {[number, number, number]} a - First version tuple.
 * @param {[number, number, number]} b - Second version tuple.
 * @returns {number} Negative if a < b, zero if equal, positive if a > b.
 * @example
 * compareTuples([16, 0, 0], [18, 0, 0]); // -2
 */
function compareTuples(a, b) {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return 0;
}

/**
 * Determine whether a given Node version satisfies the engines.node range string.
 * Supports: `>=X`, `>X`, `^X`, `~X`, `=X`, `X`, and `||`-separated alternatives.
 * Pre-release suffixes (e.g. `-rc.1`) are stripped before comparison.
 *
 * @param {string} range - The engines.node range (e.g. ">=16" or "^20.19.0 || >=22").
 * @param {[number, number, number]} ver - The Node version tuple to test.
 * @returns {boolean} True if `ver` satisfies the range.
 * @example
 * satisfies(">=16", [16, 20, 2]); // true
 * satisfies("^20 || >=22", [16, 20, 2]); // false
 */
function satisfies(range, ver) {
	// Handle OR alternatives
	if (range.includes("||")) {
		return range.split("||").some((part) => satisfies(part.trim(), ver));
	}

	const part = range.trim();

	// Handle space-separated AND ranges (e.g. ">=16 <18")
	if (/\s/.test(part)) {
		return part.split(/\s+/).every((r) => satisfies(r.trim(), ver));
	}

	// Strip pre-release suffixes from the range version
	const match = part.match(/^([><=^~!]*)([0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?)/);
	if (!match) return true; // Can't parse — assume ok

	const op = match[1];
	const rangeVer = parseVersion(match[2]);

	if (op === ">=" || op === "") return compareTuples(ver, rangeVer) >= 0;
	if (op === ">") return compareTuples(ver, rangeVer) > 0;
	if (op === "<=") return compareTuples(ver, rangeVer) <= 0;
	if (op === "<") return compareTuples(ver, rangeVer) < 0;
	if (op === "=") return compareTuples(ver, rangeVer) === 0;

	// Caret: ^X.Y.Z — compatible with X.*.* (same major, >=minor.patch)
	if (op === "^") {
		if (rangeVer[0] !== 0) return ver[0] === rangeVer[0] && compareTuples(ver, rangeVer) >= 0;
		if (rangeVer[1] !== 0) return ver[0] === 0 && ver[1] === rangeVer[1] && compareTuples(ver, rangeVer) >= 0;
		return compareTuples(ver, rangeVer) === 0;
	}

	// Tilde: ~X.Y — same major.minor, >=patch
	if (op === "~") {
		return ver[0] === rangeVer[0] && ver[1] === rangeVer[1] && compareTuples(ver, rangeVer) >= 0;
	}

	return true;
}

/**
 * Read the engines.node field from a package in node_modules, if present.
 *
 * @param {string} pkgName - The npm package name (may include scope).
 * @returns {string|null} The engines.node range string, or null.
 * @example
 * getEnginesNode("chalk"); // ">=12"
 */
function getEnginesNode(pkgName) {
	try {
		const pkgPath = path.join(nodeModulesDir, pkgName, "package.json");
		const data = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
		return data.engines?.node ?? null;
	} catch {
		return null;
	}
}

/**
 * Recursively collect transitive dependency names for a package from node_modules.
 * Stops at already-seen packages to avoid cycles.
 *
 * @param {string} pkgName - The npm package name.
 * @param {Set<string>} seen - Accumulated set of already-visited packages.
 * @returns {Set<string>} All transitive dependency names (including pkgName itself).
 * @example
 * collectTransitiveDeps("vitest", new Set()); // Set { "vitest", "vite", ... }
 */
function collectTransitiveDeps(pkgName, seen = new Set()) {
	if (seen.has(pkgName)) return seen;
	seen.add(pkgName);
	try {
		const pkgPath = path.join(nodeModulesDir, pkgName, "package.json");
		const data = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
		for (const dep of Object.keys(data.dependencies ?? {})) {
			collectTransitiveDeps(dep, seen);
		}
		for (const dep of Object.keys(data.peerDependencies ?? {})) {
			// Only follow optional peers if actually installed
			const meta = data.peerDependenciesMeta?.[dep];
			if (!meta?.optional) collectTransitiveDeps(dep, seen);
		}
	} catch {
		// package not in node_modules or unreadable — skip
	}
	return seen;
}

/**
 * Main entry point. Checks all devDependencies and their transitive deps against
 * the target Node version, then prints a report.
 *
 * @returns {void}
 * @example
 * // node tools/dev/check-engines.mjs 16.20.2
 */
function main() {
	const targetVersionStr = process.argv[2] ?? process.version;
	const targetVer = parseVersion(targetVersionStr);
	const targetDisplay = `v${targetVer.join(".")}`;

	const devDeps = Object.keys(packageJson.devDependencies ?? {});

	console.log(`\n🔍  Engine compatibility check — target: Node ${targetDisplay}`);
	console.log(`    Checking ${devDeps.length} direct devDependencies...\n`);

	let totalViolations = 0;

	for (const dep of devDeps) {
		const allDeps = collectTransitiveDeps(dep);
		const violations = [];

		for (const pkg of allDeps) {
			const enginesNode = getEnginesNode(pkg);
			if (!enginesNode) continue;
			if (!satisfies(enginesNode, targetVer)) {
				const isDirect = pkg === dep;
				violations.push({ pkg, enginesNode, isDirect });
			}
		}

		if (violations.length > 0) {
			totalViolations += violations.length;
			console.log(`❌  ${dep}`);
			for (const v of violations) {
				const label = v.isDirect ? "  (direct)" : "  (transitive)";
				console.log(`      ${v.pkg}  requires: ${v.enginesNode}${label}`);
			}
			console.log();
		}
	}

	if (totalViolations === 0) {
		console.log(`✅  All devDependencies are compatible with Node ${targetDisplay}\n`);
	} else {
		console.log(`\n⚠️   ${totalViolations} engine violation(s) found.\n`);
		process.exitCode = 1;
	}
}

main();
