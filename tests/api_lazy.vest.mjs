import { describe, test, expect, beforeAll } from "vitest";
import slothlet from "../slothlet.mjs";

let bound;
beforeAll(async () => {
	await slothlet.load({ lazy: true, dir: "./api_test" });
	bound = slothlet.createBoundApi({});
});

describe("objectDefaultMethod module (object with default method)", () => {
	test("default method via api.objectDefaultMethod()", async () => {
		expect(await bound.objectDefaultMethod("Hello World")).toBe("INFO: Hello World");
		expect(await bound.objectDefaultMethod("Warn World", "warn")).toBe("WARN: Warn World");
		expect(await bound.objectDefaultMethod("Error World", "error")).toBe("ERROR: Error World");
		expect(await bound.objectDefaultMethod("Unknown World", "unknown")).toBe("INFO: Unknown World");
	});
	test("named info method", async () => {
		expect(await bound.objectDefaultMethod.info("Info Only")).toBe("INFO: Info Only");
	});
	test("named warn method", async () => {
		expect(await bound.objectDefaultMethod.warn("Warn Only")).toBe("WARN: Warn Only");
	});
	test("named error method", async () => {
		expect(await bound.objectDefaultMethod.error("Error Only")).toBe("ERROR: Error Only");
	});
});

describe("object modules (math, string)", () => {
	describe("math", () => {
		test("add", async () => {
			expect(await bound.math.add(2, 3)).toBe(5);
		});
		test("multiply", async () => {
			expect(await bound.math.multiply(2, 3)).toBe(6);
		});
	});
	describe("string", () => {
		test("upper", async () => {
			expect(await bound.string.upper("abc")).toBe("ABC");
		});
		test("reverse", async () => {
			expect(await bound.string.reverse("abc")).toBe("cba");
		});
	});
});

describe("nested.date module", () => {
	test("today", async () => {
		expect(await bound.nested.date.today()).toBe("2025-08-15");
	});
});

describe("multi module", () => {
	test("alpha.hello", async () => {
		expect(await bound.multi.alpha.hello()).toBe("alpha hello");
	});
	test("beta.world", async () => {
		expect(await bound.multi.beta.world()).toBe("beta world");
	});
});

describe("funcmod module", () => {
	test("funcmod", async () => {
		expect(await bound.funcmod("slothlet")).toBe("Hello, slothlet!");
	});
});

describe("multi_func module", () => {
	test("alpha", async () => {
		expect(await bound.multi_func.alpha("alpha")).toBe("alpha: alpha");
	});
	test("beta.hello", async () => {
		expect(await bound.multi_func.beta.hello()).toBe("beta hello");
	});
});

describe("exportDefault module", () => {
	test("default", async () => {
		expect(await bound.exportDefault()).toBe("exportDefault default");
	});
	test("extra", async () => {
		expect(await bound.exportDefault.extra()).toBe("extra method overridden");
	});
});
