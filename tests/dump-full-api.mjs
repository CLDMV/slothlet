/**
 * Full API structure dump for debugging
 */
import slothlet from "@cldmv/slothlet";
import util from "util";

async function dumpApiStructure() {
	console.log("🔍 Dumping full API structures...\n");

	try {
		// Test CJS-only API
		console.log("=".repeat(60));
		console.log("📋 CJS-only API (api_test_cjs):");
		console.log("=".repeat(60));

		const cjsApi = await slothlet({
			dir: "../api_tests/api_test_cjs",
			debug: false
		});

		console.log(
			util.inspect(cjsApi, {
				depth: 4,
				colors: true,
				showHidden: false,
				maxArrayLength: 20
			})
		);

		await cjsApi.shutdown();

		console.log("\n" + "=".repeat(60));
		console.log("📋 Mixed ESM/CJS API (api_test_mixed):");
		console.log("=".repeat(60));

		const mixedApi = await slothlet({
			dir: "../api_tests/api_test_mixed",
			debug: false
		});

		console.log(
			util.inspect(mixedApi, {
				depth: 4,
				colors: true,
				showHidden: false,
				maxArrayLength: 20
			})
		);

		await mixedApi.shutdown();

		console.log("\n" + "=".repeat(60));
		console.log("📋 Original ESM API (api_test):");
		console.log("=".repeat(60));

		const esmApi = await slothlet({
			dir: "api_test",
			debug: false
		});

		console.log(
			util.inspect(esmApi, {
				depth: 4,
				colors: true,
				showHidden: false,
				maxArrayLength: 20
			})
		);

		await esmApi.shutdown();
	} catch (error) {
		console.error("❌ Error during dump:", error);
	}
}

dumpApiStructure();
