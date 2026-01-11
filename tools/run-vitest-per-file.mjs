/**
 * @fileoverview Run Vitest sequentially per test file with heap logging to isolate memory-heavy suites. Internal file (not exported in package.json).
 * @module @cldmv/slothlet.tools.run-vitest-per-file
 * @internal
 * @private
 *
 * @description
 * Discovers Vitest test files under tests/ and runs each one individually with --logHeapUsage to surface per-file memory consumption.
 * Ensures slothlet dev env vars are set, supports optional heap cap via VITEST_HEAP_MB, and forwards extra Vitest CLI args.
 *
 * @example
 * // Run all test files sequentially with heap logging
 * npm run vitest:per-file
 *
 * @example
 * // Increase heap for each run
 * VITEST_HEAP_MB=8192 npm run vitest:per-file
 *
 * @example
 * // Pass extra Vitest args (e.g., update snapshots)
 * npm run vitest:per-file -- --update
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const vitestEntrypoint = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfigPath = path.join(".configs", "vitest.config.mjs");

/**
 * Discover Vitest test files based on config include patterns.
 * If process filters are provided via VITEST_PROCESS_DIR or CLI args, include those directories.
 * @returns {Promise<string[]>} Sorted list of test file paths (relative to project root).
 */
async function discoverVitestFiles() {
	const testsRoot = path.resolve(projectRoot, "tests");
	const extraDirs = [];
	if (process.env.VITEST_PROCESS_DIR) {
		extraDirs.push(process.env.VITEST_PROCESS_DIR);
	}
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

	for (const dir of extraDirs) {
		const abs = path.resolve(projectRoot, dir);
		let entries;
		try {
			entries = await fs.readdir(abs, { withFileTypes: true });
		} catch (___error) {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const name = entry.name;
			if (/\.vest\.(?:js|mjs)$/i.test(name) || /\.test\.vitest\.(?:js|mjs)$/i.test(name)) {
				const rel = path.relative(projectRoot, path.join(abs, name));
				files.push(rel);
			}
		}
	}

	return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Run a single test file with Vitest and log heap usage.
 * Streams Vitest output to the console while capturing heap-related lines for summary.
 *
 * @param {string} filePath - Test file path relative to project root.
 * @param {string[]} extraArgs - Additional Vitest CLI args.
 * @param {number | undefined} maxOldSpaceMb - Optional heap size to inject via NODE_OPTIONS.
 * @returns {Promise<{file: string, code: number, duration: number, heapLines: string[], heapMb?: number}>} Result summary.
 */
async function runSingleFile(filePath, extraArgs, maxOldSpaceMb) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const args = [vitestEntrypoint, "--config", vitestConfigPath, "run", "--logHeapUsage", filePath, ...extraArgs];

		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) baseEnv.NODE_ENV = "development";
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
			stdio: ["ignore", "pipe", "pipe"],
			env: baseEnv
		});

		const heapLines = [];
		let heapMb;
		const heapRegex = /([0-9]+)\s*MB\s+heap\s+used/i;
		const captureHeap = (chunk) => {
			chunk
				.toString()
				.split(/\r?\n/)
				.forEach((line) => {
					if (/heap/i.test(line) || /memory/i.test(line)) {
						heapLines.push(line.trim());
						const match = line.match(heapRegex);
						if (match) {
							heapMb = Number.parseInt(match[1], 10);
						}
					}
				});
		};

		child.stdout?.on("data", (data) => {
			process.stdout.write(data);
			captureHeap(data);
		});

		child.stderr?.on("data", (data) => {
			process.stderr.write(data);
			captureHeap(data);
		});

		child.on("close", (code) => {
			const duration = Date.now() - startTime;
			resolve({ file: filePath, code: code ?? 1, duration, heapLines, heapMb });
		});

		child.on("error", () => {
			const duration = Date.now() - startTime;
			resolve({ file: filePath, code: 1, duration, heapLines, heapMb });
		});
	});
}

/**
 * Main runner: executes all test files sequentially with heap logging.
 * Prints heap-related lines when present to help identify high-usage suites.
 *
 * @returns {Promise<void>} Resolves when complete; exits non-zero on failure.
 */
async function runAllFiles() {
	const testFiles = await discoverVitestFiles();
	if (testFiles.length === 0) {
		console.log("No Vitest files found under tests/");
		return;
	}

	const maxOldSpaceMb = process.env.VITEST_HEAP_MB ? Number.parseInt(process.env.VITEST_HEAP_MB, 10) : undefined;
	const extraArgs = process.argv.slice(2);
	const results = [];

	console.log(`▶️  Running ${testFiles.length} test files sequentially with --logHeapUsage`);
	if (maxOldSpaceMb) {
		console.log(`🧠 Applying --max-old-space-size=${maxOldSpaceMb} to each run`);
	}

	for (const filePath of testFiles) {
		console.log(`\n🔄 Running ${filePath} ...`);
		const result = await runSingleFile(filePath, extraArgs, maxOldSpaceMb);
		results.push(result);
		if (result.heapLines.length > 0) {
			const tail = result.heapLines.slice(-5).join("\n");
			console.log("   Heap lines:");
			console.log(tail);
		}
		if (result.code === 0) {
			console.log(`✅ ${filePath} (${result.duration}ms)`);
		} else {
			console.log(`❌ ${filePath} failed (exit code ${result.code}, ${result.duration}ms)`);
			break;
		}
	}

	const failed = results.filter((r) => r.code !== 0);
	const passed = results.length - failed.length;
	console.log("\n📊 Per-file run summary");
	console.log("-".repeat(40));
	console.log(`Passed: ${passed}/${results.length}`);

	const withHeap = results.filter((r) => typeof r.heapMb === "number");
	if (withHeap.length > 0) {
		console.log("\nTop memory users (MB heap used):");
		withHeap
			.sort((a, b) => (b.heapMb || 0) - (a.heapMb || 0))
			.slice(0, 10)
			.forEach((r) => {
				console.log(`  ${r.heapMb} MB	${r.file}`);
			});
	}
	if (failed.length > 0) {
		console.log(`First failure: ${failed[0].file} (exit code ${failed[0].code})`);
		process.exit(1);
	}
}

runAllFiles();
