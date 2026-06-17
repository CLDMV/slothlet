/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/coverage/merge-browser-coverage.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Merge the browser-mode v8 coverage (coverage-browser/coverage-final.json) into the
 * node-suite coverage (coverage/coverage-final.json). Both are produced by the SAME @vitest/coverage-v8
 * pipeline against the same src, so per-file statement/branch maps match and istanbul-lib-coverage can
 * sum them: the browser run covers the `!isNode` arms the node run cannot reach, and vice versa.
 * Writes the merged map back to coverage/coverage-final.json so `coverage:analyze` sees the union.
 *
 * Usage: node tools/coverage/merge-browser-coverage.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import libCoverage from "istanbul-lib-coverage";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NODE_FINAL = resolve(REPO, "coverage/coverage-final.json");
const BROWSER_FINAL = resolve(REPO, "coverage-browser/coverage-final.json");

function load(p) {
	if (!existsSync(p)) throw new Error(`coverage file missing: ${p}`);
	return JSON.parse(readFileSync(p, "utf8"));
}

const node = load(NODE_FINAL);
const browser = load(BROWSER_FINAL);

const map = libCoverage.createCoverageMap(node);
const browserMap = libCoverage.createCoverageMap(browser);

// Merge browser coverage into the node map. For files present in both, istanbul sums hit counts
// (maps must match — they do, same v8 pipeline + src). Files only in the browser map are added.
let merged = 0;
for (const file of browserMap.files()) {
	map.merge({ [file]: browserMap.fileCoverageFor(file).data });
	merged++;
}

writeFileSync(NODE_FINAL, JSON.stringify(map.toJSON()));
console.log(`Merged ${merged} browser file(s) into ${NODE_FINAL.replace(REPO + "/", "")}`);
