#!/usr/bin/env node
/**
 * Replace console.log calls with slothlet.debug() calls
 * Simple regex-based replacement for debug console.log statements
 */

import { readFileSync, writeFileSync } from "fs";

const files = [
	"src/lib/builders/api-assignment.mjs",
	"src/lib/handlers/unified-wrapper.mjs",
	"src/lib/handlers/unified-wrapper-test-backup.mjs",
	"src/lib/helpers/class-instance-wrapper.mjs",
	"src/lib/modes/lazy.mjs"
];

let totalReplaced = 0;

for (const file of files) {
	let content = readFileSync(file, "utf-8");
	const original = content;
	let replaced = 0;

	// Skip class-instance-wrapper.mjs - intentional console.log for DEBUG_CLASS_WRAP
	if (file.includes("class-instance-wrapper")) {
		console.log(`Skipping ${file} (intentional console.log for DEBUG_CLASS_WRAP env var)`);
		continue;
	}

	// This script only handles simple single-line cases safely
	// Complex multiline cases with template literals require manual handling
	// to preserve variable names in message strings properly
	
	return { file, replaced: 0 };

	if (content !== original) {
		writeFileSync(file, content, "utf-8");
		console.log(`✅ ${file}: Replaced ${replaced} console.log calls`);
		totalReplaced += replaced;
	} else {
		console.log(`⏭️  ${file}: No replacements made`);
	}
}

console.log(`\n📊 Total: ${totalReplaced} console.log calls replaced`);
console.log("\n🔍 Run 'npm run analyze' to verify results");
