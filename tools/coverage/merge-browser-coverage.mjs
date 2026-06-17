/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/coverage/merge-browser-coverage.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Merge the browser-mode v8 coverage (coverage-browser/coverage-final.json) into the
 * node-suite coverage (coverage/coverage-final.json) so the `!isNode` arms the browser run exercises
 * are counted in the gate.
 *
 * LOCATION-BASED merge (not istanbul's union merge, which corrupts). The node (vite SSR transform) and
 * browser (vite client transform) runs produce per-file istanbul maps that are NOT byte-identical —
 * different statement/branch ids, sometimes different counts (dynamic-import wrapping adds nodes). A
 * union merge then invents phantom entries and turns covered lines into false-uncovered. Instead we
 * keep node's map + totals EXACTLY and, for each node statement/branch/function, look up the browser
 * entry at the SAME SOURCE LOCATION and ADD its hit count. Nothing node didn't already have is ever
 * added, so totals can't inflate; the browser only fills in arms node couldn't reach. Browser coverage
 * is scoped (see .configs/vitest.browser.config.mjs) to the arm-bearing files only.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import libCoverage from "istanbul-lib-coverage";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NODE_FINAL = resolve(REPO, "coverage/coverage-final.json");
const NODE_SUMMARY = resolve(REPO, "coverage/coverage-summary.json");
const BROWSER_FINAL = resolve(REPO, "coverage-browser/coverage-final.json");

function load(p) {
	if (!existsSync(p)) throw new Error(`coverage file missing: ${p}`);
	return JSON.parse(readFileSync(p, "utf8"));
}

/** Stable key for a source location; null when the location is absent/synthetic (won't be matched). */
const locKey = (loc) =>
	loc && loc.start && typeof loc.start.line === "number" && typeof loc.end?.line === "number"
		? `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`
		: null;

const node = load(NODE_FINAL);
const browser = load(BROWSER_FINAL);

let filled = 0;
for (const [file, b] of Object.entries(browser)) {
	const n = node[file];
	if (!n) continue; // browser-only file — node is the base.

	// Index browser hit-counts by source location.
	const bStmt = {};
	for (const [id, loc] of Object.entries(b.statementMap)) {
		const k = locKey(loc);
		if (k) bStmt[k] = (bStmt[k] || 0) + b.s[id];
	}
	const bFn = {};
	for (const [id, fn] of Object.entries(b.fnMap)) {
		const k = locKey(fn.decl || fn.loc);
		if (k) bFn[k] = (bFn[k] || 0) + b.f[id];
	}
	// Branches are matched by the branch's OWN source location (not each arm's): an arm such as an
	// `if`'s implicit else has no location, so per-arm location-matching can't transfer it. Group
	// browser branches by decl location, then transfer arm-hits by index to the node branch with the
	// same arm count.
	const bBranch = {};
	for (const [id, br] of Object.entries(b.branchMap)) {
		const k = locKey(br.loc);
		if (k) (bBranch[k] = bBranch[k] || []).push(b.b[id]);
	}

	// Add browser hits onto node's matching entries (node map/totals unchanged).
	for (const [id, loc] of Object.entries(n.statementMap)) {
		const h = bStmt[locKey(loc)];
		if (h) n.s[id] += h;
	}
	for (const [id, fn] of Object.entries(n.fnMap)) {
		const h = bFn[locKey(fn.decl || fn.loc)];
		if (h) n.f[id] += h;
	}
	for (const [id, br] of Object.entries(n.branchMap)) {
		const cands = bBranch[locKey(br.loc)];
		if (!cands) continue;
		const arms = cands.find((a) => a.length === n.b[id].length);
		if (arms) n.b[id].forEach((_, i) => (n.b[id][i] += arms[i] || 0));
	}
	filled++;
}

writeFileSync(NODE_FINAL, JSON.stringify(node));

// Regenerate coverage-summary.json from the merged map (badge/summary source).
const map = libCoverage.createCoverageMap(node);
const total = libCoverage.createCoverageSummary();
const summary = {};
for (const file of map.files()) {
	const fileSummary = map.fileCoverageFor(file).toSummary();
	summary[file] = fileSummary.data;
	total.merge(fileSummary);
}
writeFileSync(NODE_SUMMARY, JSON.stringify({ total: total.data, ...summary }));

console.log(`Location-based merge: filled browser hits into ${filled} file(s) (node totals preserved).`);
