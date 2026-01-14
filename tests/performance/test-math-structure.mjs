/**
 * Test if api.math structure is different between eager and lazy
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
	console.log("🔍 Inspecting api.math Structure\n");

	const eager = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const lazy = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy.math.add(2, 3); // Materialize

	console.log("=== EAGER MODE ===");
	console.log("typeof api.math:", typeof eager.math);
	console.log("api.math constructor:", eager.math.constructor.name);
	console.log("api.math is Proxy?", util.types.isProxy(eager.math));
	console.log("api.math own properties:", Object.getOwnPropertyNames(eager.math));
	console.log("Full api.math:");
	console.log(util.inspect(eager.math, { depth: 1, showHidden: true }));

	console.log("\n=== LAZY MODE ===");
	console.log("typeof api.math:", typeof lazy.math);
	console.log("api.math constructor:", lazy.math.constructor.name);
	console.log("api.math is Proxy?", util.types.isProxy(lazy.math));
	console.log("api.math own properties:", Object.getOwnPropertyNames(lazy.math));
	console.log("Full api.math:");
	console.log(util.inspect(lazy.math, { depth: 1, showHidden: true }));

	console.log("\n=== DIRECT ACCESS TEST ===");
	// Test if there's a difference in property descriptor
	console.log("Eager api.math.add descriptor:");
	console.log(Object.getOwnPropertyDescriptor(eager.math, "add"));

	console.log("\nLazy api.math.add descriptor:");
	console.log(Object.getOwnPropertyDescriptor(lazy.math, "add"));

	await eager.shutdown();
	await lazy.shutdown();
}

main().catch(console.error);
