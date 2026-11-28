/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/validate-typescript.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:55-08:00 (1795869055)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execSync } from "child_process";
import { writeFileSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { pathToFileURL } from "node:url";
import { cleanTmpArtifacts } from "./lib/clean-tmp-artifacts.mjs";

/**
 * Gets list of .mjs files in a directory.
 * @internal
 * @private
 * @param {string} dirPath - Directory path to scan
 * @returns {string[]} Array of .mjs filenames
 */
function getFilesInDir(dirPath) {
	try {
		return readdirSync(dirPath).filter((file) => file.endsWith(".mjs") && statSync(join(dirPath, file)).isFile());
	} catch (_) {
		return [];
	}
}

/**
 * Main validation entry point for CI/build automation.
 * @package
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If any TypeScript validation fails
 */
async function main() {
	console.log("🔍 Starting automated TypeScript definition validation...\n");

	let tempDir = null;

	let errorHappened = false;

	try {
		// Precheck: sweep stale per-run temp folders left behind by crashed/killed runs.
		cleanTmpArtifacts();

		// Create temporary directory in project root
		const randomSuffix = randomBytes(4).toString("hex"); // 8 character random string
		// PID segment lets the tmp-artifact sweep skip dirs owned by a live process.
		tempDir = join(process.cwd(), "tmp", `ts-validate-${process.pid}-${randomSuffix}`);
		mkdirSync(tempDir, { recursive: true });
		console.log(`📁 Using temp directory: ${tempDir}`);

		// Step 1: Get all exports from package.json
		console.log("\n1. Reading package.json exports...");
		const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
		const exports = packageJson.exports || {};

		console.log(`✅ Found ${Object.keys(exports).length} export paths`);

		// Step 2: Test each export individually
		console.log("\n2. Testing each export individually...");

		let testCount = 0;
		for (const [exportPath, _] of Object.entries(exports)) {
			if (exportPath === ".") continue; // Skip main export for now

			if (exportPath.endsWith("/*")) {
				// Handle glob patterns - expand to actual files
				const baseDir = exportPath.replace("./", "").replace("/*", "");
				const files = getFilesInDir(`src/lib/${baseDir}`);

				for (const file of files) {
					const fileName = file.replace(".mjs", "");
					const moduleName = `@cldmv/slothlet/${baseDir}/${fileName}`;
					console.log(`   Testing: ${moduleName}`);

					await testSingleExport(tempDir, moduleName, testCount++);
					console.log(`   ✅ ${moduleName} validated`);
				}
			} else {
				const moduleName = `@cldmv/slothlet${exportPath.replace("./", "/")}`;
				console.log(`   Testing: ${moduleName}`);

				await testSingleExport(tempDir, moduleName, testCount++);
				console.log(`   ✅ ${moduleName} validated`);
			}
		}

		// Step 3: Test main export separately (it's more complex)
		console.log("\n3. Testing main export...");
		await testMainExport(tempDir);
		console.log("✅ Main export validated");

		console.log("\n4. Testing self's type for a function root and an object root...");
		await testSelfRootTypes(tempDir);
		console.log("✅ self types as the api root (callable for a function root only)");

		console.log("\n🎉 All TypeScript definitions validated successfully!");
		console.log(`✅ Tested ${testCount + 1} exports individually`);
		console.log("✅ Ready for CI/production deployment");
	} catch (error) {
		console.error("\n❌ TypeScript validation failed:", error.message);
		errorHappened = true;
	} finally {
		// Always cleanup temp directory
		if (tempDir) {
			try {
				rmSync(tempDir, { recursive: true, force: true });
				console.log("🧹 Temporary directory cleaned up");
			} catch (error) {
				console.warn(`Warning: Could not cleanup temp directory ${tempDir}:`, error.message);
			}
		}
	}
	if (errorHappened) {
		process.exit(1);
	}
}

/**
 * Tests a single export path by importing it and checking for basic functionality.
 * @internal
 * @private
 * @param {string} tempDir - Temporary directory path
 * @param {string} moduleName - Import path to test
 * @param {number} testNum - Test number for progress display
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the export test fails
 */
async function testSingleExport(tempDir, moduleName, testNum) {
	const testContent = `
// Auto-generated test for ${moduleName}
import * as module from "${moduleName}";

// Basic validation - just test that import works and has valid types
const moduleType: string = typeof module;
const hasExports: boolean = Object.keys(module).length > 0;
const exportCount: number = Object.keys(module).length;

// Type assertions for compilation
const moduleAsAny: any = module;

// Export the module for potential runtime validation
export default module;
export { moduleType, hasExports, exportCount };
`;

	const testFile = join(tempDir, `test-${testNum}.mts`);
	writeFileSync(testFile, testContent, "utf8");

	try {
		// Run TypeScript from the project directory, but test the file in temp directory
		// --customConditions slothlet-dev resolves the in-repo declarations (types/src/**), not the
		// shipped stubs that re-export @cldmv/slothlet-types (which isn't installed in this repo).
		execSync(
			`npx tsc --noEmit --strict --moduleResolution bundler --customConditions slothlet-dev --module esnext --target es2022 "${testFile}"`,
			{
				stdio: "pipe",
				encoding: "utf8",
				cwd: process.cwd() // This ensures we're in the project directory with node_modules and package.json
			}
		);
	} catch (tscError) {
		console.error(`    ❌ ${moduleName} failed:`);
		console.error(tscError.stdout || tscError.stderr || tscError.message);
		throw new Error(`TypeScript validation failed for ${moduleName}`, { cause: tscError });
	}
}

/**
 * Type-checks one generated api declaration with a file that uses `self` and the host's `api` (#803).
 * @internal
 * @private
 * @param {string} dir - Directory holding the generated `api.d.ts`.
 * @param {string} body - The checked file's statements.
 * @returns {void}
 * @throws {Error} If the check fails
 */
function checkSelfProgram(dir, body) {
	const testFile = join(dir, "check.mts");
	writeFileSync(
		testFile,
		`import { self } from "@cldmv/slothlet/runtime";\nimport slothlet from "@cldmv/slothlet";\nimport type {} from "./api.js";\n${body}\nexport {};\n`,
		"utf8"
	);
	try {
		execSync(
			`npx tsc --noEmit --strict --allowJs --moduleResolution bundler --customConditions slothlet-dev --module esnext --target es2022 "${testFile}" "${join(dir, "api.d.ts")}"`,
			{ stdio: "pipe", encoding: "utf8", cwd: process.cwd() }
		);
	} catch (tscError) {
		console.error(`    ❌ ${dir} failed:`);
		console.error(tscError.stdout || tscError.stderr || tscError.message);
		throw new Error(`TypeScript validation failed for ${dir}`, { cause: tscError });
	}
}

/**
 * Tests that `self` (and the host's `api`) types as the api root (#803): callable with the root function's own
 * parameters and result when the root file exports a function, and not callable for an object root.
 * @internal
 * @private
 * @param {string} tempDir - Temporary directory path
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If a check fails
 */
async function testSelfRootTypes(tempDir) {
	const { generate } = await import("@cldmv/slothlet/typegen");
	const fixtures = join(process.cwd(), "api_tests", "api_test_self_parity");

	const fnDir = join(tempDir, "self-fnroot");
	mkdirSync(fnDir, { recursive: true });
	await generate({ base: join(fixtures, "api"), output: join(fnDir, "api.d.ts"), name: "FnRootApi" });
	checkSelfProgram(
		fnDir,
		[
			"export function leaf(): number {",
			"\tconst doubled: number = self(2);",
			"\t// @ts-expect-error The root takes a number.",
			'\tself("two");',
			"\treturn doubled + self.math.add(1, 2);",
			"}",
			"export async function host(): Promise<number> {",
			'\tconst api = await slothlet({ base: "./api" });',
			"\treturn api(2);",
			"}"
		].join("\n")
	);
	console.log("   ✅ function root: self(2) is a number");

	const objDir = join(tempDir, "self-objroot");
	mkdirSync(objDir, { recursive: true });
	await generate({ base: join(`${fixtures}_objroot`, "api"), output: join(objDir, "api.d.ts"), name: "ObjRootApi" });
	checkSelfProgram(
		objDir,
		[
			"export function leaf(): number {",
			"\t// @ts-expect-error An object root is not callable.",
			"\tself(2);",
			"\treturn self.math.add(1, 2);",
			"}"
		].join("\n")
	);
	console.log("   ✅ object root: self is not callable");
}

/**
 * Tests the main export with comprehensive type usage.
 * @internal
 * @private
 * @param {string} tempDir - Temporary directory path
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If main export test fails
 */
async function testMainExport(tempDir) {
	const testContent = `
// Main export comprehensive test
import slothlet from "@cldmv/slothlet";

async function validateMainExport(): Promise<boolean> {
    // Test main function with a broad set of canonical options
    const api: Promise<object | Function> = slothlet({
        base: './api_tests/api_test',
        mode: 'lazy',        // 'eager' | 'lazy'
        runtime: 'async',    // 'async' | 'live'
        loader: { platform: 'node' }, // execution target (independent of env)
        env: { include: ['NODE_ENV'] }, // process.env snapshot allowlist (independent of platform)
        debug: false,
        depth: 5,
        hook: true,
        silent: false,
        context: { test: true },
        reference: { version: '1.0' }
    });
    
    // Test parameter constraints
    const api2 = await slothlet(); // No parameters
    const api3 = await slothlet({}); // Empty object
    const api4 = await slothlet({ base: './test' }); // Single property
    
    
    // Test type extraction
    type SlothletType = typeof slothlet;
    type SlothletParams = Parameters<SlothletType>[0];
    type SlothletReturn = ReturnType<SlothletType>;
    
    const params: SlothletParams = { base: './test', mode: 'eager' };
    const result: SlothletReturn = slothlet(params);
    
    return true;
}

export default validateMainExport;
`;

	const testFile = join(tempDir, "test-main.mts");
	writeFileSync(testFile, testContent, "utf8");

	try {
		// --customConditions slothlet-dev resolves the in-repo declarations (types/src/**), not the
		// shipped stubs that re-export @cldmv/slothlet-types (which isn't installed in this repo).
		execSync(
			`npx tsc --noEmit --strict --moduleResolution bundler --customConditions slothlet-dev --module esnext --target es2022 "${testFile}"`,
			{
				stdio: "pipe",
				encoding: "utf8",
				cwd: process.cwd()
			}
		);
	} catch (tscError) {
		console.error("Main export test failed:");
		console.error(tscError.stdout || tscError.stderr || tscError.message);
		throw new Error("Main export TypeScript validation failed", { cause: tscError });
	}
}

// DEPRECATED: generateTypeValidationTest, getTypeFilePath, extractExportedFunctions, capitalize
// These functions were part of the old approach that generated one large test file.
// Replaced by individual export testing to avoid naming conflicts.

// DEPRECATED: validateExportsResolution, validateBuildArtifacts
// These functions were part of old validation approaches.
// Current approach uses individual export testing.

// Run if called directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error("Validation failed:", error);
		process.exit(1);
	});
}
