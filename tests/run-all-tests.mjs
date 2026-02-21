/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/run-all-tests.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 13:30:14 -08:00 (1771709414)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test runner — runs all files found in tests/node/.
 * @module @cldmv/slothlet/tests/run-all-tests
 * @package
 * @internal
 *
 * @example
 * node tests/run-all-tests.mjs
 */

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeDir = path.join(__dirname, "node");

/**
 * Run a single test file and return the result.
 * @param {string} filePath - Absolute path to the test file
 * @returns {Promise<{success: boolean, output: string, duration: number, exitCode: number}>}
 */
async function runTest(filePath) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const child = spawn("node", [filePath], {
			cwd: path.dirname(__dirname),
			stdio: ["ignore", "pipe", "pipe"]
		});

		let output = "";
		child.stdout.on("data", (d) => (output += d));
		child.stderr.on("data", (d) => (output += d));

		child.on("close", (code) => {
			resolve({ success: code === 0, output, duration: Date.now() - startTime, exitCode: code });
		});

		child.on("error", (err) => {
			resolve({ success: false, output: err.message, duration: Date.now() - startTime, exitCode: -1 });
		});
	});
}

/**
 * Discover and run all test files in tests/node/.
 * @returns {Promise<void>}
 */
async function runAllTests() {
	console.log("🧪 Running All Slothlet Tests");
	console.log("=".repeat(50));

	const files = (await readdir(nodeDir)).filter((f) => f.endsWith(".mjs") || f.endsWith(".cjs")).sort();

	if (files.length === 0) {
		console.log("⚠️  No test files found in tests/node/");
		return;
	}

	console.log(`Found ${files.length} test files:`);
	files.forEach((f) => console.log(`  📄 ${f}`));
	console.log("");

	const results = [];
	let totalDuration = 0;

	for (const file of files) {
		console.log(`🔄 Running ${file}...`);
		const result = await runTest(path.join(nodeDir, file));
		results.push({ file, ...result });
		totalDuration += result.duration;

		if (result.success) {
			console.log(`✅ ${file} passed (${result.duration}ms)`);
		} else {
			console.log(`❌ ${file} failed (${result.duration}ms) - Exit code: ${result.exitCode}`);
			const lines = result.output.trimEnd().split("\n");
			const show = lines.slice(-20);
			if (lines.length > 20) console.log(`   ... (${lines.length - 20} lines omitted)`);
			show.forEach((l) => console.log(`   ${l}`));
		}
		console.log("");
	}

	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	console.log("📊 Test Results Summary");
	console.log("=".repeat(50));
	console.log(`✅ Passed: ${passed}`);
	console.log(`❌ Failed: ${failed}`);
	console.log(`⏱️  Total: ${totalDuration}ms`);

	if (failed > 0) {
		console.log("\n❌ Failed:");
		results.filter((r) => !r.success).forEach((r) => console.log(`   node tests/node/${r.file}`));
		process.exit(1);
	}

	console.log("\n🎉 All tests passed!");
}

runAllTests();
