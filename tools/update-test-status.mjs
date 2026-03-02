#!/usr/bin/env node
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/update-test-status.mjs
 *	@Date: 2026-02-16T17:50:31-08:00 (1771293031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:22:18 -08:00 (1772425338)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Update TEST-STATUS.md based on audit results
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Read audit results
const auditFile = '/tmp/audit-results.txt';
const auditContent = readFileSync(auditFile, 'utf-8');

// Parse audit results
const statusUpdates = new Map();

// Extract tests to mark as baseline (both original and new)
const baselineSection = auditContent.match(/Tests in baseline \(change status to "✅ baseline"\):([\s\S]*?)(?=\n\n|Tests run)/);
if (baselineSection) {
	const baselineTests = baselineSection[1].trim().split('\n');
	for (const test of baselineTests) {
		const trimmed = test.trim();
		if (trimmed && trimmed.startsWith('suites/')) {
			statusUpdates.set(trimmed, {
				status: 'baseline',
				note: 'Verified passing in baseline'
			});
		}
	}
}

// Extract test results
const resultSection = auditContent.match(/Tests run \(update with results\):([\s\S]*?)$/);
if (resultSection) {
	const lines = resultSection[1].split('\n');
	let currentTest = null;
	
	for (const line of lines) {
		const testMatch = line.match(/^(suites\/[^\s]+\.vitest\.mjs)/);
		if (testMatch) {
			currentTest = testMatch[1];
			statusUpdates.set(currentTest, {});
		} else if (currentTest) {
			const statusMatch = line.match(/Status: (✅ baseline|❌ fail|❌ partial)/);
			if (statusMatch) {
				statusUpdates.get(currentTest).status = statusMatch[1];
			}
			const noteMatch = line.match(/Note: (.+)/);
			if (noteMatch) {
				statusUpdates.get(currentTest).note = noteMatch[1];
			}
		}
	}
}

console.log(`📊 Parsed ${statusUpdates.size} test status updates\n`);

// Read TEST-STATUS.md
const statusFile = join(ROOT, 'tests/vitests/TEST-STATUS.md');
let statusContent = readFileSync(statusFile, 'utf-8');

const today = new Date().toISOString().split('T')[0];
const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

// Update each test status
let updatedCount = 0;
for (const [testFile, update] of statusUpdates.entries()) {
	// Find the line for this test
	const escapedPath = testFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const lineRegex = new RegExp(`^\\| ${escapedPath} \\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|$`, 'gm');
	
	const match = lineRegex.exec(statusContent);
	if (!match) {
		console.log(`⚠️  Could not find ${testFile} in TEST-STATUS.md`);
		continue;
	}
	
	const [fullMatch, category, verified, currentStatus, notes] = match;
	
	// Build new status based on update
	let newStatus;
	if (update.status === 'baseline' || update.status === '✅ baseline') {
		newStatus = `✅ baseline (${today})`;
	} else if (update.status === '❌ fail') {
		newStatus = `❌ fail (${timestamp})`;
	} else if (update.status === '❌ partial') {
		newStatus = `❌ partial (${timestamp})`;
	} else {
		console.log(`⚠️  Unknown status for ${testFile}: ${update.status}`);
		continue;
	}
	
	// Build new notes - preserve original notes but update with new results
	let newNotes;
	if (update.status === 'baseline' || update.status === '✅ baseline') {
		newNotes = ` ${update.note} |`;
	} else {
		newNotes = ` ${update.note} - From systematic audit |`;
	}
	
	// Replace the line
	const newLine = `| ${testFile} |${category}|${verified}| ${newStatus} |${newNotes}`;
	statusContent = statusContent.replace(fullMatch, newLine);
	updatedCount++;
}

// Write updated TEST-STATUS.md
writeFileSync(statusFile, statusContent, 'utf-8');

console.log(`✅ Updated ${updatedCount} test statuses in TEST-STATUS.md`);
console.log(`\n📋 Summary:`);
console.log(`   - ${Array.from(statusUpdates.values()).filter(u => u.status === 'baseline' || u.status === '✅ baseline').length} tests marked as baseline`);
console.log(`   - ${Array.from(statusUpdates.values()).filter(u => u.status === '❌ fail').length} tests marked as failed`);
console.log(`   - ${Array.from(statusUpdates.values()).filter(u => u.status === '❌ partial').length} tests marked as partial`);
