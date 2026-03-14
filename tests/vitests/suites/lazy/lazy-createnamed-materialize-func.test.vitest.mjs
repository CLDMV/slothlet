/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-createnamed-materialize-func.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 10:41:51 -08:00 (1772476911)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for LazyMode.createNamedMaterializeFunc.
 *
 * Covers:
 *   Lines 49-52: the `_` prefix guard for apiPaths that start with a digit.
 *     e.g. "123.foo" → "123__foo" → starts with digit → becomes "_123__foo"
 *
 *   The full normalization pipeline:
 *     - dots replaced with __
 *     - non-identifier chars replaced with _
 *     - leading digit → prepend _
 *     - empty path → fallback "api"
 *     - result is a named async function: `${normalized}__lazy_materializeFunc`
 *
 * LazyMode only exports the class (no singleton), so tests use `new LazyMode()`.
 *
 * @module tests/vitests/suites/lazy/lazy-createnamed-materialize-func
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import { LazyMode } from "@cldmv/slothlet/modes/lazy";

/**
 * Shared LazyMode instance for all tests.
 * @type {LazyMode}
 */
const lazy = new LazyMode();

// ---------------------------------------------------------------------------
// 1. Digit-start paths — lines 49-52 (the _ prefix guard)
// ---------------------------------------------------------------------------
describe("LazyMode.createNamedMaterializeFunc — digit-start guard (lines 49-52)", () => {
	it("prepends _ when apiPath starts with a digit", () => {
		const fn = lazy.createNamedMaterializeFunc("123", async () => {});
		expect(fn.name).toMatch(/^_123/);
	});

	it("prepends _ for path '123.foo' → _123__foo__lazy_materializeFunc", () => {
		const fn = lazy.createNamedMaterializeFunc("123.foo", async () => {});
		expect(fn.name).toBe("_123__foo__lazy_materializeFunc");
	});

	it("prepends _ for path '9thing' → _9thing__lazy_materializeFunc", () => {
		const fn = lazy.createNamedMaterializeFunc("9thing", async () => {});
		expect(fn.name).toBe("_9thing__lazy_materializeFunc");
	});

	it("does NOT prepend _ when path starts with a letter", () => {
		const fn = lazy.createNamedMaterializeFunc("math.add", async () => {});
		expect(fn.name).not.toMatch(/^_math/);
		expect(fn.name).toBe("math__add__lazy_materializeFunc");
	});

	it("does NOT prepend _ when path starts with underscore", () => {
		const fn = lazy.createNamedMaterializeFunc("_private.thing", async () => {});
		expect(fn.name).toBe("_private__thing__lazy_materializeFunc");
	});
});

// ---------------------------------------------------------------------------
// 2. Path normalization — full pipeline
// ---------------------------------------------------------------------------
describe("LazyMode.createNamedMaterializeFunc — path normalization", () => {
	it("replaces dots with __", () => {
		const fn = lazy.createNamedMaterializeFunc("a.b.c", async () => {});
		expect(fn.name).toBe("a__b__c__lazy_materializeFunc");
	});

	it("replaces hyphens and spaces with _", () => {
		const fn = lazy.createNamedMaterializeFunc("my-api path", async () => {});
		expect(fn.name).toBe("my_api_path__lazy_materializeFunc");
	});

	it("handles empty string → falls back to api__lazy_materializeFunc", () => {
		const fn = lazy.createNamedMaterializeFunc("", async () => {});
		expect(fn.name).toBe("api__lazy_materializeFunc");
	});

	it("handles null-ish path → falls back to api__lazy_materializeFunc", () => {
		const fn = lazy.createNamedMaterializeFunc(null, async () => {});
		expect(fn.name).toBe("api__lazy_materializeFunc");
	});

	it("handles undefined path → falls back to api__lazy_materializeFunc", () => {
		const fn = lazy.createNamedMaterializeFunc(undefined, async () => {});
		expect(fn.name).toBe("api__lazy_materializeFunc");
	});

	it("typical path → correctly named", () => {
		const fn = lazy.createNamedMaterializeFunc("plugins.auth", async () => {});
		expect(fn.name).toBe("plugins__auth__lazy_materializeFunc");
	});
});

// ---------------------------------------------------------------------------
// 3. Returned function is async and delegates to handler
// ---------------------------------------------------------------------------
describe("LazyMode.createNamedMaterializeFunc — function behaviour", () => {
	it("returns an async function", () => {
		const fn = lazy.createNamedMaterializeFunc("test.path", async () => 42);
		expect(fn.constructor.name).toBe("AsyncFunction");
	});

	it("returned function calls through to handler with args", async () => {
		const handler = async (x) => x * 2;
		const fn = lazy.createNamedMaterializeFunc("test.delegate", handler);
		const result = await fn(21);
		expect(result).toBe(42);
	});

	it("returned function propagates handler errors", async () => {
		const handler = async () => {
			throw new Error("handler-error");
		};
		const fn = lazy.createNamedMaterializeFunc("test.error", handler);
		await expect(fn()).rejects.toThrow("handler-error");
	});
});
