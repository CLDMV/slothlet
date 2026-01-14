/**
 * Test if lazy mode reuses the same function objects across instances
 */

process.env.NODE_ENV = "development";
process.env.NODE_OPTIONS = "--conditions=slothlet-dev --conditions=development";

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { slothlet as rawSlothlet } from "@cldmv/slothlet/slothlet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "../../api_tests/api_test");

async function main() {
	console.log("🔍 Testing Function Object Identity Across Instances\n");

	// Create two eager instances
	const eager1 = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const eager2 = await rawSlothlet({ dir: API_DIR, mode: "eager" });

	console.log("=== EAGER MODE ===");
	console.log("Are math.add functions the same object?", eager1.math.add === eager2.math.add);
	console.log("Eager1 function:", eager1.math.add);
	console.log("Eager2 function:", eager2.math.add);

	await eager1.shutdown();
	await eager2.shutdown();

	// Create two lazy instances and materialize
	const lazy1 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy1.math.add(2, 3); // Materialize

	const lazy2 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy2.math.add(2, 3); // Materialize

	console.log("\n=== LAZY MODE ===");
	console.log("Are math.add functions the same object?", lazy1.math.add === lazy2.math.add);
	console.log("Lazy1 function:", lazy1.math.add);
	console.log("Lazy2 function:", lazy2.math.add);

	await lazy1.shutdown();
	await lazy2.shutdown();

	console.log("\n📊 ANALYSIS:");
	console.log("If functions are the SAME object (===), then:");
	console.log("  • They share JIT optimizations");
	console.log("  • Performance should be consistent across instances");
	console.log("\nIf functions are DIFFERENT objects:");
	console.log("  • Each gets its own JIT optimization");
	console.log("  • Performance can vary based on JIT compiler state");
}

main().catch(console.error);
