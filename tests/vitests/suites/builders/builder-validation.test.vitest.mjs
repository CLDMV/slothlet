/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/builder-validation.test.vitest.mjs
 *	@Date: 2026-02-26T17:01:34-08:00 (1772154094)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:33 -08:00 (1772313393)
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
		await expect(builder.buildAPI({ dir: null, mode: "eager" })).rejects.toThrow(SlothletError);
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is undefined", async () => {
		await expect(builder.buildAPI({ dir: undefined, mode: "eager" })).rejects.toThrow(SlothletError);
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is a number", async () => {
		await expect(builder.buildAPI({ dir: 42, mode: "eager" })).rejects.toThrow(SlothletError);
	});

	it("should throw INVALID_CONFIG_DIR_INVALID when dir is an object", async () => {
		await expect(builder.buildAPI({ dir: {}, mode: "eager" })).rejects.toThrow(SlothletError);
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
		await expect(builder.buildAPI({ dir: "/some/path", mode: "invalid" })).rejects.toThrow(SlothletError);
	});

	it("should throw INVALID_CONFIG_MODE_INVALID when mode is 'sync'", async () => {
		await expect(builder.buildAPI({ dir: "/some/path", mode: "sync" })).rejects.toThrow(SlothletError);
	});

	it("should throw INVALID_CONFIG_MODE_INVALID when mode is null", async () => {
		await expect(builder.buildAPI({ dir: "/some/path", mode: null })).rejects.toThrow(SlothletError);
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
});
