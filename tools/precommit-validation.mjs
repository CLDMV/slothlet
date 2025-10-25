/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/precommit-validation.mjs
 *	@Date: 2025-10-24 17:45:16 -07:00 (1761353116)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-24 17:46:26 -07:00 (1761353186)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Pre-commit validation tool that runs the mandatory validation sequence and only allows commits if all tests pass.
 * @module @cldmv/slothlet/tools/precommit-validation
 */

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Main pre-commit validation function.
 * @package
 * @async
 * @returns {Promise<void>}
 */
async function main() {
	console.log("🔍 Running Pre-Commit Validation Sequence");
	console.log("==========================================");

	const validationSteps = [
		{ name: "API Structure Debug", command: "npm", args: ["run", "debug"] },
		{ name: "Node Test Suite", command: "npm", args: ["run", "test:node"] },
		{ name: "Build Distribution", command: "npm", args: ["run", "build:dist"] },
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
					"API Structure Debug": "npm run debug",
					"Node Test Suite": "npm run test:node",
					"Build Distribution": "npm run build:dist",
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
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
			shell: true
		});

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
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error("❌ Pre-commit validation error:", error);
		process.exit(1);
	});
}
