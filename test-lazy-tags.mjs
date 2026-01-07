import slothlet from "./index.mjs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Test with LAZY mode
const api = await slothlet({ dir: join(__dirname, "./api_tests/api_test"), lazy: true, debug: false, hotReload: true });

// Add API
await api.addApi("deep", join(__dirname, "./api_tests/api_test"), {}, { moduleId: "deep-test" });

console.log("\n=== LAZY MODE ===");
console.log("api.deep:", typeof api.deep);
console.log("api.deep.__metadata:", api.deep.__metadata);
console.log("api.deep.__slothletPath:", api.deep.__slothletPath);
console.log("api.deep.math:", typeof api.deep?.math);
console.log("api.deep.math.__metadata:", api.deep?.math?.__metadata);
console.log("api.deep.math.__slothletPath:", api.deep?.math?.__slothletPath);
console.log("api.deep.math.add:", typeof api.deep?.math?.add);
console.log("api.deep.math.add.__metadata:", api.deep?.math?.add?.__metadata);
console.log("api.deep.math.add.__slothletPath:", api.deep?.math?.add?.__slothletPath);

await api.shutdown();
