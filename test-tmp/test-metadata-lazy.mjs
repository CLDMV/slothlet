import slothlet from "../index.mjs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function test() {
	console.log("Testing metadata on materialized lazy objects...\n");

	const api = await slothlet({ dir: join(__dirname, "../api_tests/api_test"), mode: "lazy", lazy: true, hotReload: true });

	// Add a nested API like Test 21 does
	await api.addApi("deep", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "deep-test" });

	console.log("After addApi:");
	console.log("  api.deep:", typeof api.deep);
	console.log("  api.deep.__metadata:", api.deep?.__metadata);
	console.log("  api.deep.__slothletPath:", api.deep?.__slothletPath);

	// Trigger materialization by calling a function
	console.log("\nTrying to access api.deep.math:");
	console.log("  typeof api.deep.math:", typeof api.deep?.math);
	console.log("  api.deep.math._materialize?:", typeof api.deep?.math?._materialize);

	// Materialize by calling
	const result = await api.deep.math.add(1, 2);
	console.log("\nAfter materialization (called add(1,2)):");
	console.log("  Result:", result);

	// Now check metadata
	console.log("\nMetadata check on api.deep.math:");
	console.log("  __metadata:", api.deep.math.__metadata);
	console.log("  __slothletPath:", api.deep.math.__slothletPath);

	console.log("\nMetadata check on api.deep:");
	console.log("  __metadata:", api.deep.__metadata);
	console.log("  __slothletPath:", api.deep.__slothletPath);

	await api.shutdown();
}

test().catch(console.error);
