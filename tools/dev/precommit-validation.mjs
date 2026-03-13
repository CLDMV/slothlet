/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/precommit-validation.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:58 -08:00 (1772425318)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runs the mandatory pre-commit validation sequence (lint → vitest → type
 * check) and exits non-zero if any step fails, preventing the commit. Invoked
 * automatically by the Husky pre-commit hook.
 * @module @cldmv/slothlet/tools/precommit-validation
 * @title npm run precommit
 *
 * @example
 * // Run manually via npm script
 * npm run precommit
 *
 * @description
 * No CLI options. The tool runs the full validation sequence unconditionally and
 * prints a pass/fail summary. Exit code mirrors the result of the last failing step.
 */

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Main pre-commit validation function.
 * @internal
 * @package
 * @async
 * @returns {Promise<void>}
 */
async function main() {
	console.log("🔍 Running Pre-Commit Validation Sequence");
	console.log("==========================================");

	const validationSteps = [
		{ name: "Clean Build Artifacts", command: "npm", args: ["run", "build:cleanup"] },
		{ name: "API Structure Debug", command: "npm", args: ["run", "debug"] },
		{ name: "Node Test Suite", command: "npm", args: ["run", "test:node"] },
		{ name: "Build Distribution", command: "npm", args: ["run", "build:dist"] },
		{ name: "Vitest Suite", command: "npm", args: ["run", "vitest"] },
		{ name: "Build TypeScript Types", command: "npm", args: ["run", "build:types"] },
		{ name: "Validate TypeScript", command: "npm", args: ["run", "test:types"] }
	];

	let allPassed = true;
	const results = [];

	for (const step of validationSteps) {
		console.log(`\n🔄 Running: ${step.name}`);
		console.log(`   Command: ${step.command} ${step.args.join(" ")}`);

		const startTime = Date.now();
		const result = await runCommand(step.command, step.args);
		const duration = Date.now() - startTime;

		if (result.success) {
			console.log(`✅ ${step.name} passed (${duration}ms)`);
			results.push({ step: step.name, status: "PASSED", duration });
		} else {
			console.log(`❌ ${step.name} failed (${duration}ms)`);
			console.log(`   Exit code: ${result.exitCode}`);
			if (result.stderr) {
				console.log(`   Error: ${result.stderr.slice(0, 500)}${result.stderr.length > 500 ? "..." : ""}`);
			}
			results.push({ step: step.name, status: "FAILED", duration, exitCode: result.exitCode });
			allPassed = false;
			break; // Stop on first failure
		}
	}

	console.log("\n📊 Pre-Commit Validation Results");
	console.log("==================================");

	results.forEach((result, index) => {
		const icon = result.status === "PASSED" ? "✅" : "❌";
		const duration = `${result.duration}ms`;
		console.log(`${icon} ${index + 1}. ${result.step} - ${result.status} (${duration})`);
	});

	if (allPassed) {
		console.log("\n🎉 All validation steps passed! Ready to commit.");
		console.log("\n💡 You can now run:");
		console.log("   git add -A");
		console.log('   git commit -m "your commit message"');
		process.exit(0);
	} else {
		console.log("\n🚫 Validation failed! Please fix the errors before committing.");
		console.log("\n💡 To debug individual steps, run:");
		results.forEach((result) => {
			if (result.status === "FAILED") {
				const stepCommands = {
					"Clean Build Artifacts": "npm run build:cleanup",
					"API Structure Debug": "npm run debug",
					"Node Test Suite": "npm run test:node",
					"Build Distribution": "npm run build:dist",
					"Vitest Suite": "npm run vitest",
					"Build TypeScript Types": "npm run build:types",
					"Validate TypeScript": "npm run test:types"
				};
				console.log(`   ${stepCommands[result.step]}`);
			}
		});
		process.exit(1);
	}
}

/**
 * Runs a shell command and returns the result.
 * @internal
 * @private
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @returns {Promise<{success: boolean, exitCode: number, stdout: string, stderr: string}>}
 */
async function runCommand(command, args) {
	return new Promise((resolve) => {
		// Use shell: true on Windows to find npm.cmd, but avoid the deprecation warning
		// by not passing args when shell is true - instead construct a single command string
		const isWindows = process.platform === "win32";
		const needsShell = isWindows && (command === "npm" || command === "node");

		let child;
		if (needsShell) {
			// On Windows, construct full command string for shell
			const fullCommand = `${command} ${args.join(" ")}`;
			child = spawn(fullCommand, [], {
				stdio: ["ignore", "pipe", "pipe"],
				shell: true
			});
		} else {
			child = spawn(command, args, {
				stdio: ["ignore", "pipe", "pipe"]
			});
		}

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (exitCode) => {
			resolve({
				success: exitCode === 0,
				exitCode: exitCode || 0,
				stdout,
				stderr
			});
		});

		child.on("error", (error) => {
			resolve({
				success: false,
				exitCode: -1,
				stdout,
				stderr: error.message
			});
		});
	});
}

// Run if called directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error("❌ Pre-commit validation error:", error);
		process.exit(1);
	});
}
