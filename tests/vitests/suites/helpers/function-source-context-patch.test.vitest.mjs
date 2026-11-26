/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/function-source-context-patch.test.vitest.mjs
 *	@Date: 2026-11-25T01:22:44-08:00 (1795598564)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:45:35-08:00 (1795599935)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `Function.prototype.toString` patch (#750) on its own: what it answers before a reader is set, when
 * the reader throws, and when the host's `toString` cannot be wrapped.
 *
 * @description
 * The wrapper answers the source of the function a stand-in stands for and passes every other receiver to what it
 * wraps. A host that removed `toString`, replaced it with something that is no function, or froze it keeps it as it
 * is. Turning the patch off twice, or taking the file's internal bindings twice, is refused or does nothing.
 *
 * @module tests/vitests/suites/helpers/function-source-context-patch
 */

import { describe, it, expect, afterEach } from "vitest";
import {
	disableFunctionSourcePatching,
	enableFunctionSourcePatching,
	internals,
	isFunctionSourcePatch,
	isFunctionSourcePatched,
	setFunctionSourceReader
} from "#helpers/function-source-context";

const FunctionPrototype = Function.prototype;

/**
 * A function with a known source.
 * @returns {number} One.
 */
function sample() {
	return 1;
}
const SAMPLE_SOURCE = FunctionPrototype.toString.call(sample);

afterEach(() => {
	disableFunctionSourcePatching();
});

describe("function source patch > answering", () => {
	it("answers a function's own source before any reader is set", () => {
		enableFunctionSourcePatching();
		expect(isFunctionSourcePatch(FunctionPrototype.toString)).toBe(true);
		expect(isFunctionSourcePatched(FunctionPrototype.toString)).toBe(true);
		expect(FunctionPrototype.toString.call(sample)).toBe(SAMPLE_SOURCE);
	});

	it("answers as before when telling the receiver throws", () => {
		setFunctionSourceReader(() => {
			throw new Error("reader failed");
		});
		enableFunctionSourcePatching();
		expect(FunctionPrototype.toString.call(sample)).toBe(SAMPLE_SOURCE);
		expect(() => FunctionPrototype.toString.call({})).toThrow(TypeError);
	});

	it("answers the source of the function a stand-in stands for", () => {
		const standIn = () => 2;
		setFunctionSourceReader((value) => (value === standIn ? sample : undefined));
		enableFunctionSourcePatching();
		expect(FunctionPrototype.toString.call(standIn)).toBe(SAMPLE_SOURCE);
		// Asked about itself, the wrapper answers as the function it wraps.
		expect(FunctionPrototype.toString.call(FunctionPrototype.toString)).toMatch(/\[native code\]/);
	});

	it("does nothing when turned off twice", () => {
		enableFunctionSourcePatching();
		const wrapper = FunctionPrototype.toString;
		disableFunctionSourcePatching();
		expect(FunctionPrototype.toString).not.toBe(wrapper);
		const restored = FunctionPrototype.toString;
		disableFunctionSourcePatching();
		expect(FunctionPrototype.toString).toBe(restored);
	});
});

describe("function source patch > a toString that cannot be wrapped", () => {
	it("leaves a removed toString removed", () => {
		const saved = Object.getOwnPropertyDescriptor(FunctionPrototype, "toString");
		delete FunctionPrototype.toString;
		try {
			enableFunctionSourcePatching();
			expect(Object.hasOwn(FunctionPrototype, "toString")).toBe(false);
		} finally {
			Object.defineProperty(FunctionPrototype, "toString", saved);
		}
	});

	it("leaves a toString that is no function as it is", () => {
		const saved = Object.getOwnPropertyDescriptor(FunctionPrototype, "toString");
		Object.defineProperty(FunctionPrototype, "toString", { ...saved, value: "not a function" });
		try {
			enableFunctionSourcePatching();
			expect(FunctionPrototype.toString).toBe("not a function");
		} finally {
			Object.defineProperty(FunctionPrototype, "toString", saved);
		}
	});
});

describe("function source patch > internal bindings", () => {
	it("refuses a file that is not listed", () => {
		expect(() => internals("lib/handlers/frame-placement")).toThrow();
	});

	it("refuses a listed file a second time outside its own top level", () => {
		// The first take may already have been made by slothlet's own file as it loaded; the second is always refused.
		expect(() => {
			internals("slothlet");
			internals("slothlet");
		}).toThrow();
	});
});

// Last: freezing `Function.prototype.toString` cannot be undone in this process.
describe("function source patch > a frozen toString", () => {
	it("leaves a frozen toString as it is", () => {
		const original = FunctionPrototype.toString;
		Object.defineProperty(FunctionPrototype, "toString", { writable: false, configurable: false });
		enableFunctionSourcePatching();
		expect(FunctionPrototype.toString).toBe(original);
		expect(isFunctionSourcePatched(FunctionPrototype.toString)).toBe(false);
	});
});
