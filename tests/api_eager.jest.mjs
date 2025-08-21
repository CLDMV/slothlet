/**
 * Eager (non-lazy) test for slothlet API loader using Jest.
 * Runs every call in api_test with eager loading.
 */
import slothlet from "../src/slothlet.mjs";

let bound;
beforeAll(async () => {
	await slothlet.load({ lazy: false, dir: "./api_test" });
	bound = slothlet.createBoundApi({});
});

test("math.add", () => {
	expect(bound.math.add(2, 3)).toBe(5);
});

test("math.multiply", () => {
	expect(bound.math.multiply(2, 3)).toBe(6);
});

test("string.upper", () => {
	expect(bound.string.upper("abc")).toBe("ABC");
});

test("string.reverse", () => {
	expect(bound.string.reverse("abc")).toBe("cba");
});

test("nested.date.today", () => {
	expect(bound.nested.date.today()).toBe("2025-08-15");
});

test("multi.alpha.hello", () => {
	expect(bound.multi.alpha.hello()).toBe("alpha hello");
});

test("multi.beta.world", () => {
	expect(bound.multi.beta.world()).toBe("beta world");
});

test("funcmod", () => {
	expect(bound.funcmod("slothlet")).toBe("Hello, slothlet!");
});

test("multi_func.alpha", () => {
	expect(bound.multi_func.alpha("alpha")).toBe("alpha: alpha");
});

test("multi_func.beta.hello", () => {
	expect(bound.multi_func.beta.hello()).toBe("beta hello");
});
