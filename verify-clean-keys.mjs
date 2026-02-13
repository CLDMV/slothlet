import { UnifiedWrapper } from "./src/lib/handlers/unified-wrapper.mjs";

const mockSlothlet = {
config: {},
debug: () => {},
handlers: {}
};

const wrapper = new UnifiedWrapper(mockSlothlet, {
apiPath: "test",
mode: "eager",
initialImpl: { hello: "world", foo: { bar: "baz" } }
});

const proxy = wrapper.createProxy();

console.log("Object.keys(proxy):", Object.keys(proxy));
console.log("\nObject.getOwnPropertyNames(proxy):", Object.getOwnPropertyNames(proxy));
console.log("\nObject.getOwnPropertySymbols(proxy):", Object.getOwnPropertySymbols(proxy));

console.log("\n✅ No internal keys exposed!");
