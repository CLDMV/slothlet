import { execSync } from "child_process";
import { writeFileSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

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
		// Create temporary directory in project root
		const randomSuffix = randomBytes(4).toString("hex"); // 8 character random string
		tempDir = join(process.cwd(), `ts-validate-${randomSuffix}`);
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
		execSync(`npx tsc --noEmit --strict --moduleResolution bundler --module esnext --target es2022 "${testFile}"`, {
			stdio: "pipe",
			encoding: "utf8",
			cwd: process.cwd() // This ensures we're in the project directory with node_modules and package.json
		});
	} catch (tscError) {
		console.error(`    ❌ ${moduleName} failed:`);
		console.error(tscError.stdout || tscError.stderr || tscError.message);
		throw new Error(`TypeScript validation failed for ${moduleName}`);
	}
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
    // Test main function with all options (including new mode/engine syntax)
    const api: Promise<object | Function> = slothlet({
        dir: './api_tests/api_test',
        mode: 'lazy',        // New syntax for loading mode
        engine: 'singleton', // New syntax for execution environment
        debug: false,
        apiDepth: 5,
        api_mode: 'auto',
        context: { test: true },
        reference: { version: '1.0' }
    });
    
    // Test parameter constraints
    const api2 = await slothlet(); // No parameters
    const api3 = await slothlet({}); // Empty object
    const api4 = await slothlet({ dir: './test' }); // Single property
    
    // Test legacy syntax (should still work)
    const apiLegacy = await slothlet({
        dir: './api_tests/api_test',
        lazy: true,          // Legacy boolean syntax
        mode: 'singleton'    // Legacy execution mode placement
    });
    
    // Test type extraction
    type SlothletType = typeof slothlet;
    type SlothletParams = Parameters<SlothletType>[0];
    type SlothletReturn = ReturnType<SlothletType>;
    
    const params: SlothletParams = { dir: './test', mode: 'eager' };
    const result: SlothletReturn = slothlet(params);
    
    return true;
}

export default validateMainExport;
`;

	const testFile = join(tempDir, "test-main.mts");
	writeFileSync(testFile, testContent, "utf8");

	try {
		execSync(`npx tsc --noEmit --strict --moduleResolution bundler --module esnext --target es2022 "${testFile}"`, {
			stdio: "pipe",
			encoding: "utf8",
			cwd: process.cwd()
		});
	} catch (tscError) {
		console.error("Main export test failed:");
		console.error(tscError.stdout || tscError.stderr || tscError.message);
		throw new Error("Main export TypeScript validation failed");
	}
}

// DEPRECATED: generateTypeValidationTest, getTypeFilePath, extractExportedFunctions, capitalize
// These functions were part of the old approach that generated one large test file.
// Replaced by individual export testing to avoid naming conflicts.

// DEPRECATED: validateExportsResolution, validateBuildArtifacts
// These functions were part of old validation approaches.
// Current approach uses individual export testing.

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith("validate-typescript.mjs")) {
	main().catch((error) => {
		console.error("Validation failed:", error);
		process.exit(1);
	});
}
