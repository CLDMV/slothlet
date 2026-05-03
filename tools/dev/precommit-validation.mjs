/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/precommit-validation.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-10 20:09:06 -07:00 (1775876946)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runs the mandatory pre-commit validation sequence (fix:headers →
 * analyze → build:dev → debug → test:node [→ vitest unless --min]) and exits
 * non-zero if any step fails, preventing the commit. Invoked automatically by the
 * Husky pre-commit hook.
 * @module @cldmv/slothlet/tools/precommit-validation
 * @title npm run precommit
 *
 * @example
 * // Run manually via npm script
 * npm run precommit
 *
 * @example
 * // Run minimal mode (skip Vitest, defer to coverage)
 * npm run precommit -- --min
 *
 * @description
 * Supports `--min` to run a minimal quality gate sequence that skips Vitest.
 * Default mode runs the full sequence including Vitest. Exit code mirrors the
 * result of the last failing step.
 */

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Parse CLI options for the pre-commit validator.
 *
 * @param {string[]} argv - Command-line args (e.g. `process.argv.slice(2)`).
 * @returns {{ min: boolean }} Normalized options.
 * @example
 * parseArgs(["--min"]);
 * // { min: true }
 */
function parseArgs(argv) {
	return {
		min: argv.includes("--min")
	};
}

/**
 * Main pre-commit validation function.
 * @internal
 * @package
 * @async
 * @returns {Promise<void>}
 * @example
 * await main();
 */
async function main() {
	const options = parseArgs(process.argv.slice(2));
	const isMinMode = options.min;

	console.log("🔍 Running Pre-Commit Validation Sequence");
	console.log("==========================================");
	if (isMinMode) {
		console.log("🧩 Mode: minimal (--min) - Vitest step skipped");
	}

	const validationSteps = [
		{ name: "Fix File Headers", command: "npm", args: ["run", "fix:headers"] },
		{ name: "Analyze Error and i18n Quality", command: "npm", args: ["run", "analyze"] },
		{ name: "Build Full Artifacts", command: "npm", args: ["run", "build:dev"] },
		{ name: "API Structure Debug", command: "npm", args: ["run", "debug"] },
		{ name: "Node Test Suite", command: "npm", args: ["run", "test:node"] }
	];

	if (!isMinMode) {
		validationSteps.push({ name: "Vitest Suite", command: "npm", args: ["run", "vitest"] });
	}

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
		if (isMinMode) {
			console.log("\n📝 Minimal mode note: run `npm run coverage` before final commit validation.");
		}
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
					"Fix File Headers": "npm run fix:headers",
					"Analyze Error and i18n Quality": "npm run analyze",
					"API Structure Debug": "npm run debug",
					"Node Test Suite": "npm run test:node",
					"Build Full Artifacts": "npm run build:dev",
					"Vitest Suite": "npm run vitest"
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
