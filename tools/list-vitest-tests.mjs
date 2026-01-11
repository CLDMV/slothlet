/**
 * @fileoverview Lists Vitest files and their test titles for quick inspection.
 * @module tools/list-vitest-tests
 * @internal
 *
 * @description
 * Scans tests/vitests for *.test.vitest.{js,mjs} (and *.vest.{js,mjs}) files,
 * extracts describe/test/it titles, and prints them grouped by file.
 * You can optionally pass a single file (relative to project root) to limit output.
 *
 * @example
 * node tools/list-vitest-tests.mjs
 * node tools/list-vitest-tests.mjs tests/vitests/hooks-comprehensive.test.vitest.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const vitestRoot = path.join(projectRoot, "tests", "vitests");

const TEST_FILE_REGEX = /\.(?:test\.vitest|vest)\.(?:js|mjs)$/i;
// Match describe/test/it("title") at word boundaries to avoid collisions with e.g. split().
const TITLE_REGEX = /\b(describe|test|it)\s*\(\s*(["'`])([^"'`]*?)\2/gi;

/**
 * Read and list tests for a single file.
 * @param {string} filePath - Absolute path to the test file.
 * @returns {Promise<{file: string, titles: Array<{type: string, title: string}>}>}
 */
async function listTestsInFile(filePath) {
	const content = await fs.readFile(filePath, "utf8");
	const titles = [];
	let match;
	while ((match = TITLE_REGEX.exec(content)) !== null) {
		const [, type, , title] = match;
		const cleaned = title.trim();
		if (cleaned.length === 0) {
			continue;
		}
		titles.push({ type, title: cleaned });
	}
	return { file: path.relative(projectRoot, filePath), titles };
}

/**
 * Discover Vitest files, optionally filtering to a single target.
 * @param {string | undefined} targetRelPath - Optional relative path to a single file.
 * @returns {Promise<string[]>} Sorted absolute paths to test files.
 */
async function discoverTestFiles(targetRelPath) {
	if (targetRelPath) {
		const abs = path.resolve(projectRoot, targetRelPath);
		return [abs];
	}

	const dirs = [vitestRoot, path.join(vitestRoot, "process")];
	const files = [];

	for (const dir of dirs) {
		let entries;
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch (___error) {
			continue;
		}
		entries
			.filter((entry) => entry.isFile() && TEST_FILE_REGEX.test(entry.name))
			.forEach((entry) => files.push(path.join(dir, entry.name)));
	}

	return files.sort();
}

/**
 * Main execution: list tests grouped by file.
 * @returns {Promise<void>} Resolves when done.
 */
async function run() {
	const targetArg = process.argv[2];
	const files = await discoverTestFiles(targetArg);

	if (files.length === 0) {
		console.log("No Vitest files found.");
		return;
	}

	for (const file of files) {
		try {
			const { file: rel, titles } = await listTestsInFile(file);
			console.log(`\n📄 ${rel}`);
			if (titles.length === 0) {
				console.log("   (no titles found)");
				continue;
			}
			titles.forEach((entry) => {
				console.log(`   [${entry.type}] ${entry.title}`);
			});
		} catch (error) {
			console.error(`Failed to read ${file}: ${error.message}`);
		}
	}
}

run();
