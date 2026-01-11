/**
 * @fileoverview Sharded Vitest runner for slothlet.
 * @module tools/run-vitest-shards
 * @description
 * Runs Vitest test suites in sequential shards to reduce peak memory usage.
 * Uses the project vitest config and defaults to 30 shards, configurable via
 * the VITEST_SHARD_TOTAL environment variable. Additional Vitest arguments
 * passed after "--" are forwarded to each shard.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
// Use the Node entrypoint to avoid shell quirks on Windows
const vitestEntrypoint = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfigPath = path.join(".configs", "vitest.config.mjs");

/**
 * Discover Vitest test files based on config include patterns.
 * @returns {Promise<string[]>} Sorted list of test file paths (relative to project root).
 */
async function discoverVitestFiles() {
	const testsRoot = path.resolve(projectRoot, "tests");
	const queue = [testsRoot];
	const files = [];

	while (queue.length) {
		const current = queue.pop();
		let entries;
		try {
			entries = await fs.readdir(current, { withFileTypes: true });
		} catch (___error) {
			// Skip unreadable directories
			continue;
		}

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
				queue.push(path.join(current, entry.name));
				continue;
			}

			if (!entry.isFile()) continue;
			const name = entry.name;
			if (/\.vest\.(?:js|mjs)$/i.test(name) || /\.test\.vitest\.(?:js|mjs)$/i.test(name)) {
				const rel = path.relative(projectRoot, path.join(current, name));
				files.push(rel);
			}
		}
	}

	return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Chunk files for a given shard.
 * @param {string[]} files - Sorted file list.
 * @param {number} shardIndex - One-based shard index.
 * @param {number} shardTotal - Total shards.
 * @returns {string[]} Files assigned to this shard.
 */
function filesForShard(files, shardIndex, shardTotal) {
	if (files.length === 0) return [];
	const chunkSize = Math.ceil(files.length / shardTotal);
	const start = (shardIndex - 1) * chunkSize;
	return files.slice(start, start + chunkSize);
}

/**
 * Parse and validate the desired shard count.
 * @param {string | undefined} rawTotal - Raw shard total from environment.
 * @returns {number | undefined} Validated shard count (minimum 1) or undefined if not provided.
 */
function parseShardTotal(rawTotal) {
	if (rawTotal === undefined) return undefined;
	const parsed = Number.parseInt(rawTotal, 10);
	if (Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}
	return undefined;
}

/**
 * Parse and validate files-per-shard target.
 * @param {string | undefined} rawValue - Raw files-per-shard value from environment.
 * @returns {number} Validated files-per-shard target (minimum 1).
 */
function parseFilesPerShard(rawValue) {
	const parsed = Number.parseInt(rawValue ?? "4", 10);
	if (Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}
	return 4;
}

/**
 * Run a single Vitest shard and stream its output.
 * @param {number} shardIndex - One-based shard index.
 * @param {number} shardTotal - Total shard count.
 * @param {string[]} extraArgs - Additional Vitest CLI args to forward.
 * @returns {Promise<{ index: number, code: number, duration: number }>} Result object.
 */
async function runShard(shardIndex, shardTotal, extraArgs, shardFiles, maxOldSpaceMb) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const shardLabel = `${shardIndex}/${shardTotal}`;

		const args = [vitestEntrypoint, "--config", vitestConfigPath, "run", "--shard", shardLabel, ...extraArgs];

		// Ensure devcheck-friendly defaults
		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) {
			baseEnv.NODE_ENV = "development";
		}
		const hasDevCondition = baseEnv.NODE_OPTIONS?.includes("--conditions=slothlet-dev");
		if (!hasDevCondition) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--conditions=slothlet-dev`.trim();
		}
		if (maxOldSpaceMb && !baseEnv.NODE_OPTIONS?.includes("--max-old-space-size")) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--max-old-space-size=${maxOldSpaceMb}`.trim();
		}

		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: "inherit",
			env: baseEnv
		});

		let stdoutTail = [];
		let stderrTail = [];

		child.on("close", (code) => {
			const duration = Date.now() - startTime;
			resolve({ index: shardIndex, code: code ?? 1, duration, stdout: stdoutTail.join("\n"), stderr: stderrTail.join("\n") });
		});

		child.on("error", () => {
			const duration = Date.now() - startTime;
			resolve({ index: shardIndex, code: 1, duration, stdout: stdoutTail.join("\n"), stderr: stderrTail.join("\n") });
		});
	});
}

/**
 * Run all shards sequentially and summarize results.
 * @returns {Promise<void>} Resolves when all shards finish; exits process on failure.
 */
async function runShardedSuite() {
	const requestedShardTotal = parseShardTotal(process.env.VITEST_SHARD_TOTAL);
	const filesPerShard = parseFilesPerShard(process.env.VITEST_FILES_PER_SHARD);
	const testFiles = await discoverVitestFiles();
	const testFileCount = testFiles.length;
	const recommendedShardTotal = testFileCount > 0 ? Math.max(1, Math.ceil(testFileCount / filesPerShard)) : 1;
	const shardTotalBase = requestedShardTotal ?? recommendedShardTotal;
	const shardTotal = testFileCount > 0 ? Math.max(1, Math.min(shardTotalBase, testFileCount)) : shardTotalBase;
	const clamped = requestedShardTotal !== undefined && shardTotal !== requestedShardTotal;
	const extraArgs = process.argv.slice(2);
	const results = [];

	if (clamped) {
		console.log(
			`▶️  Running Vitest in ${shardTotal} shards (clamped from ${requestedShardTotal} because only ${testFileCount} test files were found)`
		);
	} else if (requestedShardTotal !== undefined) {
		console.log(`▶️  Running Vitest in ${shardTotal} shards (requested via VITEST_SHARD_TOTAL)`);
	} else {
		console.log(`▶️  Running Vitest in ${shardTotal} shards (~${filesPerShard} files per shard target)`);
	}

	const maxOldSpaceMb = process.env.VITEST_HEAP_MB ? Number.parseInt(process.env.VITEST_HEAP_MB, 10) : undefined;

	for (let index = 1; index <= shardTotal; index += 1) {
		const shardFiles = filesForShard(testFiles, index, shardTotal);
		const shardFilesPreview = shardFiles.slice(0, 10).join(", ") + (shardFiles.length > 10 ? " ..." : "");
		console.log(`
🔄 Shard ${index}/${shardTotal} (files: ${shardFiles.length})${shardFiles.length ? `: ${shardFilesPreview}` : ""}`);
		const result = await runShard(index, shardTotal, extraArgs, shardFiles, maxOldSpaceMb);
		results.push(result);
	}

	const failed = results.filter((entry) => entry.code !== 0);
	const passed = results.length - failed.length;
	const totalDuration = results.reduce((sum, entry) => sum + entry.duration, 0);

	console.log("\n📊 Vitest shard summary");
	console.log("-".repeat(40));
	console.log(`Shards passed: ${passed}/${results.length}`);
	console.log(`Total duration: ${totalDuration}ms`);

	if (failed.length > 0) {
		failed.forEach((entry) => {
			console.log(`❌ Shard ${entry.index}/${shardTotal} failed (exit code ${entry.code})`);
			const tail = (entry.stderr || entry.stdout || "").split("\n").slice(-80).join("\n");
			if (tail) {
				console.log("--- Shard output tail ---");
				console.log(tail);
				console.log("-------------------------");
			}
		});
		process.exit(1);
	}

	console.log("✅ All shards completed successfully");
	if (results.length > 0) {
		const lastShard = results[results.length - 1];
		const tail = (lastShard.stdout || "").split("\n").filter(Boolean).slice(-20).join("\n");
		if (tail) {
			console.log("--- Final shard summary tail ---");
			console.log(tail);
			console.log("---------------------------------");
		}
	}
}

runShardedSuite();
