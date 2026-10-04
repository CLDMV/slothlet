/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-options-validation.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:24-07:00 (1791090924)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Normalization and validation of the `typescript` options object (#499).
 *
 * @description
 * `normalizeTypeScript()` must carry every documented option — `target`, `sourcemap`, and the
 * strict-mode options `module`, `strict`, `compilerOptions` — through to the normalized config,
 * and reject a value of the wrong type with INVALID_CONFIG (both directly and through the real
 * `slothlet({...})` config path).
 *
 * @module tests/vitests/suites/typescript/typescript-options-validation.test.vitest
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { Config } from "@cldmv/slothlet/helpers/config";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import slothlet from "../../../../index.mjs";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/**
 * Minimal mock slothlet satisfying Config's ComponentBase requirements.
 * @returns {object} Mock slothlet instance.
 */
function makeMock() {
	return {
		config: {},
		debug: vi.fn(),
		SlothletError,
		SlothletWarning,
		helpers: { resolver: { resolvePathFromCaller: (dir) => dir } }
	};
}

let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe("normalizeTypeScript — option pass-through", () => {
	it("carries module, strict and compilerOptions through the object form", () => {
		const cfg = new Config(makeMock());
		const compilerOptions = { noUnusedLocals: true };
		const result = cfg.normalizeTypeScript({ mode: "strict", module: "esnext", strict: false, compilerOptions });
		expect(result).toMatchObject({ enabled: true, mode: "strict", module: "esnext", strict: false, compilerOptions });
	});

	it("keeps sourcemap: true", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeTypeScript({ mode: "fast", sourcemap: true })).toMatchObject({ sourcemap: true });
	});

	it("is idempotent on an already-normalized config", () => {
		const cfg = new Config(makeMock());
		const once = cfg.normalizeTypeScript({ mode: "strict", module: "esnext", strict: false, compilerOptions: { noUnusedLocals: true } });
		expect(cfg.normalizeTypeScript(once)).toEqual(once);
	});
});

describe("normalizeTypeScript — INVALID_CONFIG", () => {
	const cases = [
		["target", 2020],
		["module", 99],
		["strict", "no"],
		["sourcemap", "inline"],
		["compilerOptions", "noUnusedLocals"],
		["compilerOptions", ["noUnusedLocals"]],
		["compilerOptions", new Map()]
	];

	it.each(cases)("rejects typescript.%s = %o", (option, value) => {
		const cfg = new Config(makeMock());
		expect(() => cfg.normalizeTypeScript({ mode: "strict", [option]: value })).toThrow(expect.objectContaining({ code: "INVALID_CONFIG" }));
	});

	it.each([
		["an array", ["x"], "array"],
		["a class instance", new Map(), "Map"],
		["a null-prototype object", Object.create(null), "object"],
		["a number", 1, "number"]
	])("reports %s as %o in the error", (_label, value, reported) => {
		const cfg = new Config(makeMock());
		expect(() => cfg.normalizeTypeScript({ mode: "strict", strict: value })).toThrow(
			expect.objectContaining({
				code: "INVALID_CONFIG",
				context: expect.objectContaining({ option: "typescript.strict", value: reported })
			})
		);
	});

	it("rejects an invalid option through slothlet()", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ dir: "./api_tests/api_test_typescript", silent: true, typescript: { mode: "fast", strict: "yes" } })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});
	});
});
