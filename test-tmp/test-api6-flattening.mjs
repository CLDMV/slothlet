import slothlet from "../index.mjs";

const sl = await slothlet({
	dir: "./test-tmp/api",
	eager: true,
	context: { folderName: "api6-test" },
	debug: true
});

// Test with autoFlatten=true (default)
console.log("=== Testing api6 with autoFlatten=true (default) ===");
await sl.addApi("./test-tmp/api6");
console.log("API structure with autoFlatten=true:");
console.log(
	"Available functions:",
	Object.keys(sl).filter((key) => typeof sl[key] === "function")
);

// Test with autoFlatten=false
const sl2 = await slothlet({
	dir: "./test-tmp/api",
	eager: true,
	context: { folderName: "api6-test-no-flatten" },
	debug: true
});

console.log("\n=== Testing api6 with autoFlatten=false ===");
await sl2.addApi("./test-tmp/api6", { autoFlatten: false });
console.log("API structure with autoFlatten=false:");
console.log(
	"Available at root:",
	Object.keys(sl2).filter((key) => typeof sl2[key] === "function")
);
console.log("api6 namespace:", sl2.api6 ? Object.keys(sl2.api6) : "None");

await sl.shutdown();
await sl2.shutdown();
