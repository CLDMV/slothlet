/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/run-all-tests.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:40 -08:00 (1772425300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test runner - runs all files found in tests/node/.
 * @module @cldmv/slothlet/tests/run-all-tests
 * @package
 * @internal
 *
 * @example
 * node tests/run-all-tests.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeDir = path.join(__dirname, "node");

/**
 * Ensure slothlet dev conditions are set when running against src/ (no dist/ present).
 * When dist/ IS present, actively strips the slothlet-dev condition from NODE_OPTIONS so
 * that child test processes (spawned via spawn()) do not inherit it and accidentally resolve
 * package imports via src/ (which may have been deleted by ci:cleanup-src in a prior CI step).
 * Respawns the current process with the required NODE_OPTIONS flags if needed.
 * @returns {boolean} True if a child process was spawned (caller should return immediately).
 * @example
 * if (ensureDevEnvFlags()) return; // parent stays alive; child.on('exit') calls process.exit(child_code)
 */
function ensureDevEnvFlags() {
	const distPath = path.join(__dirname, "../dist");
	if (existsSync(distPath)) {
		return false;
	}

	/**
	 * @param {string[]} args
	 * @param {string} condition
	 * @returns {boolean}
	 */
	const hasCondition = (args, condition) =>
		args.some((arg) => arg.startsWith("--conditions=") && arg.slice("--conditions=".length).split(/[|,]/u).includes(condition));

	process.env.NODE_ENV = "development";

	const requiredConditions = ["slothlet-dev"];
	const nextExecArgv = [...process.execArgv];
	const envConditions = (process.env.NODE_OPTIONS ?? "")
		.split(/\s+/u)
		.filter(Boolean)
		.filter((token) => token !== "--conditions=development|production");

	let needsRespawn = false;

	for (const condition of requiredConditions) {
		const flag = `--conditions=${condition}`;
		// Check both command-line execArgv AND NODE_OPTIONS env var — NODE_OPTIONS flags are active
		// but never appear in process.execArgv, so checking only execArgv causes a needless respawn.
		const inExecArgv = hasCondition(nextExecArgv, condition);
		const inNodeOptions = envConditions.some((token) => token === flag);
		if (!inExecArgv && !inNodeOptions) {
			nextExecArgv.push(flag);
			needsRespawn = true;
		}
		if (!envConditions.includes(flag)) {
			envConditions.push(flag);
		}
	}

	process.env.NODE_OPTIONS = envConditions.join(" ");

	if (!needsRespawn) {
		return false;
	}

	const child = spawn(process.argv[0], [...nextExecArgv, ...process.argv.slice(1)], {
		env: { ...process.env, NODE_ENV: "development", NODE_OPTIONS: process.env.NODE_OPTIONS },
		stdio: "inherit"
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});

	return true;
}

// When ensureDevEnvFlags() returns true a child process has been spawned and
// child.on("exit") will call process.exit(code) with the child's real exit code.
// DO NOT call process.exit() here — that would kill the parent immediately (exit 0)
// before the child finishes, causing test-conditional.mjs to see a false success.
if (!ensureDevEnvFlags()) {
	runAllTests();
}

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
