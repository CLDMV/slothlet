import slothlet from "./index.mjs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Test LAZY MODE with MATERIALIZATION before reload
const api = await slothlet({ dir: join(__dirname, "./api_tests/api_test"), lazy: true, debug: false, hotReload: true });

// Add API
await api.addApi("deep", join(__dirname, "./api_tests/api_test"), {}, { moduleId: "deep-test" });

console.log("\n=== Step 1: After addApi ===");
console.log("api.deep.math type:", typeof api.deep?.math);
console.log("api.deep.math._materialize?:", typeof api.deep?.math?._materialize);

// Step 2: MATERIALIZE by calling a function
console.log("\n=== Step 2: Materialize by calling function ===");
const result1 = await api.deep.math.add(2, 3);
console.log("await api.deep.math.add(2, 3):", result1);

// Now store references AFTER materialization
console.log("\n=== Step 3: Store references AFTER materialization ===");
const mathRef = api.deep.math;
const addRef = api.deep.math.add;
console.log("mathRef type:", typeof mathRef, mathRef?._materialize ? "(lazy)" : "(materialized)");
console.log("addRef type:", typeof addRef);

// Step 4: Reload
console.log("\n=== Step 4: Reload ===");
await api.reloadApi("deep");

// Step 5: Check references
console.log("\n=== Step 5: After reload ===");
console.log("api.deep.math type:", typeof api.deep?.math);
console.log("api.deep.math === mathRef:", api.deep?.math === mathRef);
console.log("api.deep.math.add === addRef:", api.deep?.math?.add === addRef);

// Step 6: Verify function still works
console.log("\n=== Step 6: Verify functions work ===");
const result2 = await mathRef.add(4, 5);
console.log("mathRef.add(4, 5):", result2);
const result3 = await api.deep.math.add(6, 7);
console.log("api.deep.math.add(6, 7):", result3);

await api.shutdown();
