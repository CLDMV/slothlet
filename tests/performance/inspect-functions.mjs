/**
 * Inspect actual function implementation differences between eager and lazy
 */

process.env.NODE_ENV = "development";
process.env.NODE_OPTIONS = "--conditions=slothlet-dev --conditions=development";

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import util from "util";
import { slothlet as rawSlothlet } from "@cldmv/slothlet/slothlet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "../../api_tests/api_test");

async function main() {
	console.log("🔍 Inspecting Function Implementation Differences\n");

	// Create eager instance
	const eager = await rawSlothlet({ dir: API_DIR, mode: "eager" });

	// Create lazy instance and materialize
	const lazy = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy.math.add(2, 3); // Materialize

	console.log("=== EAGER MODE ===");
	console.log("typeof api.math.add:", typeof eager.math.add);
	console.log("Function name:", eager.math.add.name);
	console.log("Has __slothletPath?", "__slothletPath" in eager.math.add);
	console.log("__slothletPath value:", eager.math.add.__slothletPath);
	console.log("Function toString:", eager.math.add.toString().substring(0, 200));
	console.log("Own properties:", Object.getOwnPropertyNames(eager.math.add));
	console.log("Prototype:", Object.getPrototypeOf(eager.math.add));
	console.log("\nFull inspect:");
	console.log(util.inspect(eager.math.add, { depth: 2, showHidden: true }));

	console.log("\n=== LAZY MODE (after materialization) ===");
	console.log("typeof api.math.add:", typeof lazy.math.add);
	console.log("Function name:", lazy.math.add.name);
	console.log("Function toString:", lazy.math.add.toString().substring(0, 200));
	console.log("Own properties:", Object.getOwnPropertyNames(lazy.math.add));
	console.log("Prototype:", Object.getPrototypeOf(lazy.math.add));
	console.log("\nFull inspect:");
	console.log(util.inspect(lazy.math.add, { depth: 2, showHidden: true }));

	console.log("\n=== COMPARISON ===");
	console.log("Are they the same function?", eager.math.add === lazy.math.add);
	console.log("Same prototype?", Object.getPrototypeOf(eager.math.add) === Object.getPrototypeOf(lazy.math.add));
	console.log("Same toString?", eager.math.add.toString() === lazy.math.add.toString());

	await eager.shutdown();
	await lazy.shutdown();
}

main().catch(console.error);
