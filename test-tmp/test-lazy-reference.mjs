process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import slothlet from "@cldmv/slothlet";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const api = await slothlet({ dir: join(__dirname, "../api_tests/api_test"), lazy: true, hotReload: true, debug: false });

await api.addApi("deep", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "test1" });

console.log("\n=== Before reload ===");
const deepRef = api.deep;
const mathRef = api.deep.math;
const addRef = api.deep.math.add;

console.log("Got references");

console.log("\n=== Calling reloadApi ===");
await api.reloadApi("deep");

console.log("\n=== After reload ===");
const mathRef2 = api.deep.math;
const addRef2 = api.deep.math.add;

console.log("BEFORE mathRef._materialize:", typeof mathRef._materialize);
console.log("AFTER mathRef2._materialize:", typeof mathRef2._materialize);
console.log("BEFORE mathRef === mathRef2:", mathRef === mathRef2);

console.log("api.deep === deepRef:", api.deep === deepRef);
console.log("mathRef2 === mathRef:", mathRef2 === mathRef);
console.log("addRef2 === addRef:", addRef2 === addRef);
console.log("mathRef constructor:", mathRef.constructor.name);
console.log("mathRef2 constructor:", mathRef2.constructor.name);

await api.shutdown();
