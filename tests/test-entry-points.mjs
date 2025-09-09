/**
 * Combined test runner that tests both CJS and ESM entry points
 * Run this with: node tests/test-entry-points.mjs
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runTest(testFile, description) {
	return new Promise((resolve, reject) => {
		console.log(`\n📋 Running ${description}...`);
		console.log(`   Command: node ${testFile}`);
		console.log("   ─".repeat(50));

		const child = spawn("node", [testFile], {
			cwd: path.dirname(__dirname),
			stdio: "inherit"
		});

		child.on("close", (code) => {
			if (code === 0) {
				console.log(`✅ ${description} completed successfully`);
				resolve();
			} else {
				console.error(`❌ ${description} failed with exit code ${code}`);
				reject(new Error(`Test failed: ${description}`));
			}
		});

		child.on("error", (error) => {
			console.error(`❌ ${description} failed to start:`, error.message);
			reject(error);
		});
	});
}

async function runAllTests() {
	console.log("🚀 Testing Slothlet Entry Points");
	console.log("=".repeat(50));

	try {
		// Test CommonJS entry point
		await runTest(path.join(__dirname, "../index.cjs"), "CommonJS Entry Point Test");

		// Test ESM entry point
		await runTest(path.join(__dirname, "../index.mjs"), "ESM Entry Point Test");

		console.log("\n🎉 All entry point tests passed!");
		console.log("=".repeat(50));
		console.log("✅ CommonJS entry (index.cjs) works correctly");
		console.log("✅ ESM entry (index.mjs) works correctly");
		console.log("✅ Both entry points can load and use slothlet");
	} catch (error) {
		console.error("\n💥 Entry point tests failed:", error.message);
		process.exit(1);
	}
}

runAllTests().catch(console.error);
