import { describe, test, expect, beforeAll } from "vitest";
import slothlet from "../slothlet.mjs";

let bound;
beforeAll(async () => {
	await slothlet.load({ lazy: false, dir: "./api_test" });
	bound = slothlet.createBoundApi({});
});

describe("objectDefaultMethod module (object with default method)", () => {
	test("default method via api.objectDefaultMethod()", () => {
		expect(bound.objectDefaultMethod("Hello World")).toBe("INFO: Hello World");
		expect(bound.objectDefaultMethod("Warn World", "warn")).toBe("WARN: Warn World");
		expect(bound.objectDefaultMethod("Error World", "error")).toBe("ERROR: Error World");
		expect(bound.objectDefaultMethod("Unknown World", "unknown")).toBe("INFO: Unknown World");
	});
	test("named info method", () => {
		expect(bound.objectDefaultMethod.info("Info Only")).toBe("INFO: Info Only");
	});
	test("named warn method", () => {
		expect(bound.objectDefaultMethod.warn("Warn Only")).toBe("WARN: Warn Only");
	});
	test("named error method", () => {
		expect(bound.objectDefaultMethod.error("Error Only")).toBe("ERROR: Error Only");
	});
});

describe("Standard API modules", () => {
	describe("math", () => {
		test("add", async () => {
			expect(bound.math.add(2, 3)).toBe(5);
		});
		test("multiply", async () => {
			expect(bound.math.multiply(2, 3)).toBe(6);
		});
	});
	describe("string", () => {
		test("upper", async () => {
			expect(bound.string.upper("abc")).toBe("ABC");
		});
		test("reverse", async () => {
			expect(bound.string.reverse("abc")).toBe("cba");
		});
	});
	test("funcmod", async () => {
		expect(bound.funcmod("slothlet")).toBe("Hello, slothlet!");
	});
});

describe("nested.date module", () => {
	test("today", async () => {
		expect(bound.nested.date.today()).toBe("2025-08-15");
	});
});

describe("multi module", () => {
	test("alpha.hello", async () => {
		expect(bound.multi.alpha.hello()).toBe("alpha hello");
	});
	test("beta.world", async () => {
		expect(bound.multi.beta.world()).toBe("beta world");
	});
});

describe("multi_func module", () => {
	test("alpha", async () => {
		expect(bound.multi_func.alpha("alpha")).toBe("alpha: alpha");
	});
	test("beta.hello", async () => {
		expect(bound.multi_func.beta.hello()).toBe("beta hello");
	});
});

describe("exportDefault module", () => {
	test("default", async () => {
		expect(bound.exportDefault()).toBe("exportDefault default");
	});
	test("extra", async () => {
		expect(bound.exportDefault.extra()).toBe("extra method overridden");
	});
});
