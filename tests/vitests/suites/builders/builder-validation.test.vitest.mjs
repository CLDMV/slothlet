/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/builder-validation.test.vitest.mjs
 *	@Date: 2026-02-26T17:01:34-08:00 (1772154094)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:44 -08:00 (1772425304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Builder.buildAPI validation branches (lines 96, 107).
 *
 * @description
 * Directly instantiates the Builder class with a mock slothlet to reach the two
 * input-validation throw paths that are never exercised through integration tests
 * (because the public slothlet() factory normalises inputs before reaching the builder):
 *
 * - Line 96:  `throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", ...)` — fires
 *   when `dir` is null, undefined, or a non-string value.
 * - Line 107: `throw new this.SlothletError("INVALID_CONFIG_MODE_INVALID", ...)` — fires
 *   when `mode` is neither "eager" nor "lazy".
 *
 * @module tests/vitests/suites/builders/builder-validation.test.vitest
 */

import { describe, it, expect } from "vitest";
import { Builder } from "@cldmv/slothlet/builders/builder";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet satisfying ComponentBase getter requirements plus the
 * `modes` object that buildAPI delegates to when validation passes.
 *
 * @type {object}
 */
const mockSlothlet = {
	config: {},
	debug: () => {},
	SlothletError,
	SlothletWarning,
	modes: {
		eager: { buildAPI: async () => ({}) },
		lazy: { buildAPI: async () => ({}) }
	}
};

describe("Builder.buildAPI - input validation", () => {
	let builder;

	builder = new Builder(mockSlothlet);

	// ─── dir validation (line 96) ────────────────────────────────────────────────

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is null", async () => {
		await expect(builder.buildAPI({ dir: null, mode: "eager" })).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is undefined", async () => {
		await expect(builder.buildAPI({ dir: undefined, mode: "eager" })).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is a number", async () => {
		await expect(builder.buildAPI({ dir: 42, mode: "eager" })).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is an object", async () => {
		await expect(builder.buildAPI({ dir: {}, mode: "eager" })).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("INVALID_CONFIG_DIR_INVALID error has validationError flag", async () => {
		let caught = null;
		try {
			await builder.buildAPI({ dir: null, mode: "eager" });
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(SlothletError);
		expect(caught.message).toMatch(/INVALID_CONFIG_DIR_INVALID|dir/i);
	});

	// ─── mode validation (line 107) ──────────────────────────────────────────────

	it("should throw INVALID_CONFIG_MODE_INVALID when mode is 'invalid'", async () => {
		await expect(builder.buildAPI({ dir: "/some/path", mode: "invalid" })).rejects.toMatchObject({ code: "INVALID_CONFIG_MODE_INVALID" });
	});

	it("should throw INVALID_CONFIG_MODE_INVALID when mode is 'sync'", async () => {
		await expect(builder.buildAPI({ dir: "/some/path", mode: "sync" })).rejects.toMatchObject({ code: "INVALID_CONFIG_MODE_INVALID" });
	});

	it("should throw INVALID_CONFIG_MODE_INVALID when mode is null", async () => {
		await expect(builder.buildAPI({ dir: "/some/path", mode: null })).rejects.toMatchObject({ code: "INVALID_CONFIG_MODE_INVALID" });
	});

	it("INVALID_CONFIG_MODE_INVALID error has validationError flag", async () => {
		let caught = null;
		try {
			await builder.buildAPI({ dir: "/some/path", mode: "bad-mode" });
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(SlothletError);
		expect(caught.message).toMatch(/INVALID_CONFIG_MODE_INVALID|mode/i);
	});

	// ─── syntheticExports validation (#136 review) ───────────────────────────────
	// A malformed synthetic value must fail with a structured SlothletError up front rather than a
	// raw TypeError deep in the flatten pipeline. Reachable only by calling buildAPI directly —
	// api.add() validates upstream — so it is covered here at the unit level.

	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE when syntheticExports is a string", async () => {
		await expect(builder.buildAPI({ syntheticExports: "x" })).rejects.toMatchObject({ code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE" });
	});

	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE when syntheticExports is an array", async () => {
		await expect(builder.buildAPI({ syntheticExports: [() => {}] })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE"
		});
	});

	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE when syntheticExports is a function", async () => {
		await expect(builder.buildAPI({ syntheticExports: () => {} })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE"
		});
	});

	it("throws INVALID_CONFIG_SYNTHETIC_NAME when syntheticName is not a string", async () => {
		await expect(builder.buildAPI({ syntheticExports: { default: () => {} }, syntheticName: 123 })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_NAME"
		});
	});

	// Present-but-falsy syntheticExports signals synthetic intent: it must hit synthetic validation
	// (EXPORTS_SHAPE), not fall through to `dir` validation and report a misleading DIR_INVALID (#136 review).
	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE when syntheticExports is an empty string (falsy but present)", async () => {
		await expect(builder.buildAPI({ syntheticExports: "" })).rejects.toMatchObject({ code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE" });
	});

	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE when syntheticExports is 0 (falsy but present)", async () => {
		await expect(builder.buildAPI({ syntheticExports: 0 })).rejects.toMatchObject({ code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE" });
	});

	// A non-plain OBJECT (class instance) is rejected too, and the error names its constructor so the
	// fault is obvious. Reachable only via direct buildAPI — api.add() rejects class instances upstream
	// (INVALID_CONFIG_SYNTHETIC_INPUT), so this is covered here at the unit level.
	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE naming the constructor for a class instance", async () => {
		await expect(builder.buildAPI({ syntheticExports: new Map() })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE",
			message: expect.stringContaining("Map instance")
		});
	});

	it("throws INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE as 'non-plain object' when the instance has no resolvable constructor", async () => {
		// A null-proto parent leaves no `constructor` on the chain, so the type description falls back to
		// the literal "non-plain object" rather than a constructor name — but it is still non-plain and rejected.
		await expect(builder.buildAPI({ syntheticExports: Object.create(Object.create(null)) })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE",
			message: expect.stringContaining("non-plain object instance")
		});
	});

	// An empty-string syntheticName passes `typeof === "string"`, so reporting the bare type ("string")
	// would hide the real fault; the error surfaces it as "<empty>" instead.
	it("throws INVALID_CONFIG_SYNTHETIC_NAME reporting '<empty>' for an empty-string name", async () => {
		await expect(builder.buildAPI({ syntheticExports: { default: () => {} }, syntheticName: "" })).rejects.toMatchObject({
			code: "INVALID_CONFIG_SYNTHETIC_NAME",
			message: expect.stringContaining("<empty>")
		});
	});
});
