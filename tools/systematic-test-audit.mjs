#!/usr/bin/env node
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/systematic-test-audit.mjs
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
 * Systematic Test Audit Script
 * 
 * Purpose:
 * 1. Read baseline-tests.json and TEST-STATUS.md
 * 2. For tests in baseline: update status to "baseline" in TEST-STATUS.md
 * 3. For tests NOT in baseline: run them individually
 *    - If pass 100%: add to baseline-tests.json, mark "baseline" in TEST-STATUS.md
 *    - If fail: mark "❌ fail" or "❌ partial" with actual counts in TEST-STATUS.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Load baseline tests
const baselineFile = join(ROOT, 'tests/vitests/baseline-tests.json');
const baselineTests = JSON.parse(readFileSync(baselineFile, 'utf-8'));
console.log(`📋 Loaded ${baselineTests.length} tests from baseline-tests.json\n`);

// Load TEST-STATUS.md
const statusFile = join(ROOT, 'tests/vitests/TEST-STATUS.md');
const statusContent = readFileSync(statusFile, 'utf-8');

// Extract all test file paths from TEST-STATUS.md
const testFileRegex = /^\| (suites\/[^\s]+\.vitest\.mjs) \|/gm;
const allTests = [];
let match;
while ((match = testFileRegex.exec(statusContent)) !== null) {
	allTests.push(match[1]);
}

// Remove duplicates
const uniqueTests = [...new Set(allTests)];
console.log(`📝 Found ${uniqueTests.length} unique tests in TEST-STATUS.md\n`);

// Separate into baseline and non-baseline tests
const baselineSet = new Set(baselineTests);
const testsInBaseline = uniqueTests.filter(test => baselineSet.has(test));
const testsNotInBaseline = uniqueTests.filter(test => !baselineSet.has(test));

console.log(`✅ ${testsInBaseline.length} tests already in baseline`);
console.log(`🔄 ${testsNotInBaseline.length} tests need to be run\n`);

// Track results
const newBaselineTests = [...baselineTests];
const updatedStatuses = [];

// Process non-baseline tests
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('RUNNING NON-BASELINE TESTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const testFile of testsNotInBaseline) {
	console.log(`\n🧪 Running: ${testFile}`);
	console.log('─'.repeat(60));
	
	try {
		// Run the test and capture output
		const result = execSync(
			`npm run vitest ${testFile} 2>&1 | grep -E "(Test Files|Tests )"`,
			{ cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
		);
		
		console.log(result);
		
		// Parse test results - handle both pass and fail formats
		// Pass format: "Test Files  1 passed (1)" / "Tests  44 passed (44)"
		// Fail format: "Test Files  1 failed (1)" / "Tests  40 failed | 8 passed (48)"
		const testFilesPassMatch = result.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)/);
		const testFilesFailMatch = result.match(/Test Files\s+(\d+)\s+failed\s+\((\d+)\)/);
		const testsMatch = result.match(/Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?(?:\s+\((\d+)\))?/);
		
		if (!testFilesPassMatch && !testFilesFailMatch) {
			console.log('❌ Could not parse test results');
			updatedStatuses.push({
				testFile,
				status: 'fail',
				note: 'Could not parse test results',
				addToBaseline: false
			});
			continue;
		}
		
		const filesPassed = parseInt(testFilesPassMatch?.[1] || '0');
		const filesFailed = parseInt(testFilesFailMatch?.[1] || '0');
		
		const testsFailed = parseInt(testsMatch?.[1] || '0');
		const testsPassed = parseInt(testsMatch?.[2] || '0');
		const testsSkipped = parseInt(testsMatch?.[3] || '0');
		
		const totalTests = testsFailed + testsPassed + testsSkipped;
		
		// Determine status
		if (filesPassed > 0 && filesFailed === 0 && testsFailed === 0 && testsSkipped === 0) {
			// 100% pass - add to baseline
			console.log(`✅ 100% PASS - Adding to baseline`);
			newBaselineTests.push(testFile);
			updatedStatuses.push({
				testFile,
				status: 'baseline',
				note: `${testsPassed}/${totalTests} tests pass (100%)`,
				addToBaseline: true
			});
		} else if (filesPassed > 0 && (filesFailed > 0 || testsFailed > 0)) {
			// Partial pass
			console.log(`⚠️  PARTIAL - ${testsPassed} passed, ${testsFailed} failed, ${testsSkipped} skipped`);
			const note = testsFailed > 0 
				? `${testsFailed} failed | ${testsPassed} passed` + (testsSkipped > 0 ? ` | ${testsSkipped} skipped` : '')
				: `${testsPassed}/${totalTests} tests pass (${Math.round(testsPassed/totalTests*100)}%)` + (testsSkipped > 0 ? `, ${testsSkipped} skipped` : '');
			updatedStatuses.push({
				testFile,
				status: 'partial',
				note,
				addToBaseline: false
			});
		} else {
			// Complete failure
			console.log(`❌ FAIL - ${testsFailed || 'all'} tests failed`);
			const note = testsFailed > 0
				? `${testsFailed}/${totalTests} tests failed` + (testsPassed > 0 ? ` (${testsPassed} passed)` : '')
				: 'All tests failed';
			updatedStatuses.push({
				testFile,
				status: 'fail',
				note,
				addToBaseline: false
			});
		}
		
	} catch (error) {
		console.log(`❌ ERROR running test: ${error.message}`);
		updatedStatuses.push({
			testFile,
			status: 'fail',
			note: `Error running test: ${error.message}`,
			addToBaseline: false
		});
	}
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const addedToBaseline = updatedStatuses.filter(s => s.addToBaseline).length;
const partial = updatedStatuses.filter(s => s.status === 'partial').length;
const failed = updatedStatuses.filter(s => s.status === 'fail').length;

console.log(`✅ Tests added to baseline: ${addedToBaseline}`);
console.log(`⚠️  Partial failures: ${partial}`);
console.log(`❌ Complete failures: ${failed}`);
console.log(`📊 Total tests in baseline: ${baselineTests.length} → ${newBaselineTests.length}`);

// Write updated baseline-tests.json (sorted alphabetically)
newBaselineTests.sort();
writeFileSync(baselineFile, JSON.stringify(newBaselineTests, null, '\t') + '\n', 'utf-8');
console.log(`\n✅ Updated baseline-tests.json`);

// Generate status update report
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STATUS UPDATES FOR TEST-STATUS.md');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Tests in baseline (change status to "✅ baseline"):');
console.log(testsInBaseline.join('\n'));

if (updatedStatuses.length > 0) {
	console.log('\n\nTests run (update with results):');
	for (const { testFile, status, note } of updatedStatuses) {
		const statusIcon = status === 'baseline' ? '✅ baseline' : status === 'partial' ? '❌ partial' : '❌ fail';
		console.log(`\n${testFile}`);
		console.log(`  Status: ${statusIcon}`);
		console.log(`  Note: ${note}`);
	}
}

console.log('\n\n✅ Audit complete! Now update TEST-STATUS.md with these results.');
