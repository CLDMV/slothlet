/**
 * Lazy test for slothlet API loader using Jest.
 * Runs every call in api_test with lazy loading.
 */
import slothlet from "../slothlet.mjs";

let bound;
beforeAll(async () => {
	await slothlet.load({ lazy: true, dir: "./api_test" });
	bound = slothlet.createBoundApi({});
});

test("math.add", async () => {
	expect(await bound.math.add(2, 3)).toBe(5);
});

test("math.multiply", async () => {
	expect(await bound.math.multiply(2, 3)).toBe(6);
});

test("string.upper", async () => {
	expect(await bound.string.upper("abc")).toBe("ABC");
});

test("string.reverse", async () => {
	expect(await bound.string.reverse("abc")).toBe("cba");
});

test("nested.date.today", async () => {
	expect(await bound.nested.date.today()).toBe("2025-08-15");
});

test("multi.alpha.hello", async () => {
	expect(await bound.multi.alpha.hello()).toBe("alpha hello");
});

test("multi.beta.world", async () => {
	expect(await bound.multi.beta.world()).toBe("beta world");
});

test("funcmod", async () => {
	expect(await bound.funcmod("slothlet")).toBe("Hello, slothlet!");
});

test("multi_func.alpha", async () => {
	expect(await bound.multi_func.alpha("alpha")).toBe("alpha: alpha");
});

test("multi_func.beta.hello", async () => {
	expect(await bound.multi_func.beta.hello()).toBe("beta hello");
});
