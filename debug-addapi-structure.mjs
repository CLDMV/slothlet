import slothlet from "./index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

async function debugApi() {
	const api = await slothlet({ dir: path.join(__dirname, "api_tests/api_test") });

	await api.addApi("nested", path.join(__dirname, "api_tests/api_smart_flatten_nested"), {}, true);

	console.log("\n=== NESTED API STRUCTURE DEBUG ===");
	console.log("api.nested keys:", Object.keys(api.nested));
	console.log("api.nested.services keys:", Object.keys(api.nested.services || {}));
	console.log("api.nested.services.services keys:", Object.keys(api.nested.services?.services || {}));

	if (api.nested.services?.services?.services) {
		console.log("api.nested.services.services.services keys:", Object.keys(api.nested.services.services.services));
	}
	if (api.nested.api) {
		console.log("api.nested.api keys:", Object.keys(api.nested.api));
	}

	await api.shutdown();
}

debugApi().catch(console.error);
