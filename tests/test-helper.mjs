import slothlet from "@cldmv/slothlet";

// Test configuration matrix covering all meaningful slothlet initialization options
const TEST_MATRIX = [
	// Basic modes
	{ name: "EAGER_BASIC", config: { dir: "../api_tests/api_test", lazy: false, debug: false } },
	{ name: "LAZY_BASIC", config: { dir: "../api_tests/api_test", lazy: true, debug: false } },

	// API overwrite configurations
	{ name: "EAGER_ALLOW_OVERWRITE", config: { dir: "../api_tests/api_test", lazy: false, allowApiOverwrite: true, debug: false } },
	{ name: "LAZY_ALLOW_OVERWRITE", config: { dir: "../api_tests/api_test", lazy: true, allowApiOverwrite: true, debug: false } },
	{ name: "EAGER_DENY_OVERWRITE", config: { dir: "../api_tests/api_test", lazy: false, allowApiOverwrite: false, debug: false } },
	{ name: "LAZY_DENY_OVERWRITE", config: { dir: "../api_tests/api_test", lazy: true, allowApiOverwrite: false, debug: false } },

	// Hot reload feature test (one config to ensure feature works in matrix)
	{ name: "EAGER_HOT_RELOAD", config: { dir: "../api_tests/api_test", lazy: false, hotReload: true, debug: false } },
	{ name: "LAZY_HOT_RELOAD", config: { dir: "../api_tests/api_test", lazy: true, hotReload: true, debug: false } },

	// Ownership with allowApiOverwrite combinations (for Rule 12 testing)
	{
		name: "EAGER_OWNERSHIP_ALLOW_OVERWRITE",
		config: { dir: "../api_tests/api_test", lazy: false, hotReload: true, allowApiOverwrite: true, debug: false }
	},
	{
		name: "LAZY_OWNERSHIP_ALLOW_OVERWRITE",
		config: { dir: "../api_tests/api_test", lazy: true, hotReload: true, allowApiOverwrite: true, debug: false }
	},
	{
		name: "EAGER_OWNERSHIP_DENY_OVERWRITE",
		config: { dir: "../api_tests/api_test", lazy: false, hotReload: true, allowApiOverwrite: false, debug: false }
	},
	{
		name: "LAZY_OWNERSHIP_DENY_OVERWRITE",
		config: { dir: "../api_tests/api_test", lazy: true, hotReload: true, allowApiOverwrite: false, debug: false }
	},

	// API depth configurations
	{ name: "EAGER_DEPTH_1", config: { dir: "../api_tests/api_test", lazy: false, apiDepth: 1, debug: false } },
	{ name: "LAZY_DEPTH_1", config: { dir: "../api_tests/api_test", lazy: true, apiDepth: 1, debug: false } },
	{ name: "EAGER_DEPTH_3", config: { dir: "../api_tests/api_test", lazy: false, apiDepth: 3, debug: false } },
	{ name: "LAZY_DEPTH_3", config: { dir: "../api_tests/api_test", lazy: true, apiDepth: 3, debug: false } },

	// Different API directories for testing different module structures
	{ name: "EAGER_MIXED", config: { dir: "../api_tests/api_test_mixed", lazy: false, debug: false } },
	{ name: "LAZY_MIXED", config: { dir: "../api_tests/api_test_mixed", lazy: true, debug: false } },

	// Combined edge cases
	{
		name: "LAZY_ALL_FEATURES",
		config: { dir: "../api_tests/api_test", lazy: true, allowApiOverwrite: false, apiDepth: 5, debug: false }
	},
	{
		name: "EAGER_ALL_FEATURES",
		config: { dir: "../api_tests/api_test", lazy: false, allowApiOverwrite: false, apiDepth: 5, debug: false }
	}
];

/**
 * Run a test function across the complete slothlet configuration matrix
 */
export async function runTestMatrix(configOverride = {}, testFunction, testDescription = "Test Matrix") {
	const results = {
		total: 0,
		passed: 0,
		failed: 0,
		errors: []
	};

	console.log(`\n🧪 Running ${testDescription} across ${TEST_MATRIX.length} configurations...`);

	for (const { name, config } of TEST_MATRIX) {
		results.total++;
		const fullConfig = { ...config, ...configOverride };

		console.log(`\n📋 Testing configuration: ${name}`);
		console.log(`   Config: ${JSON.stringify(fullConfig, null, 2).replace(/\n/g, " ")}`);

		try {
			const api = await slothlet(fullConfig);
			await testFunction(api, name, fullConfig);

			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}

			console.log(`   ✅ PASSED: ${name}`);
			results.passed++;
		} catch (error) {
			console.log(`   ❌ FAILED: ${name}`);
			console.log(`   Error: ${error.message}`);

			results.failed++;
			results.errors.push({
				config: name,
				error: error.message,
				stack: error.stack
			});
		}
	}

	console.log(`\n📊 ${testDescription} Summary:`);
	console.log(`   Total: ${results.total}`);
	console.log(`   Passed: ${results.passed}`);
	console.log(`   Failed: ${results.failed}`);
	console.log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

	if (results.failed > 0) {
		console.log(`\n🔍 Failures:`);
		for (const error of results.errors) {
			console.log(`   - ${error.config}: ${error.error}`);
		}
	}

	// Return results so caller can track failures
	return results;
}
/**
 * Run a test with an existing API instance (for path resolution testing)
 * @param {object} api - Slothlet API instance
 * @param {Function} testFunction - Test function to run
 */
export async function runTestWithApi(api, testFunction) {
	await testFunction(api);
}
/**
 * Run a test function across only ownership-enabled configurations
 */
export async function runOwnershipTestMatrix(configOverride = {}, testFunction, testDescription = "Ownership Test Matrix") {
	const ownershipConfigs = TEST_MATRIX.filter(({ config }) => config.hotReload);

	const results = {
		total: 0,
		passed: 0,
		failed: 0,
		errors: []
	};

	console.log(`\n🔒 Running ${testDescription} across ${ownershipConfigs.length} configurations...`);

	for (const { name, config } of ownershipConfigs) {
		results.total++;
		const fullConfig = { ...config, ...configOverride };

		console.log(`\n📋 Testing ownership configuration: ${name}`);

		try {
			const api = await slothlet(fullConfig);
			await testFunction(api, name, fullConfig);

			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}

			console.log(`   ✅ PASSED: ${name}`);
			results.passed++;
		} catch (error) {
			console.log(`   ❌ FAILED: ${name}`);
			console.log(`   Error: ${error.message}`);

			results.failed++;
			results.errors.push({
				config: name,
				error: error.message
			});
		}
	}

	return results;
}

/**
 * Run a test function against specific subset of configurations
 */
export async function runSelectTestMatrix(configNames, configOverride = {}, testFunction, testDescription = "Select Test Matrix") {
	const selectedConfigs = TEST_MATRIX.filter(({ name }) => configNames.includes(name));

	console.log(`\n🎯 Running ${testDescription}: [${configNames.join(", ")}]`);

	const results = { total: 0, passed: 0, failed: 0, errors: [] };

	for (const { name, config } of selectedConfigs) {
		results.total++;
		const fullConfig = { ...config, ...configOverride };

		try {
			const api = await slothlet(fullConfig);
			await testFunction(api, name, fullConfig);

			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}

			console.log(`   ✅ PASSED: ${name}`);
			results.passed++;
		} catch (error) {
			console.log(`   ❌ FAILED: ${name} - ${error.message}`);
			results.failed++;
			results.errors.push({ config: name, error: error.message });
		}
	}

	return results;
}
