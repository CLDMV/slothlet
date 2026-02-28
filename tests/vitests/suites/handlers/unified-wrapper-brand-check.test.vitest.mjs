/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-brand-check.test.vitest.mjs
 *	@Date: 2026-02-27T21:34:23-08:00 (1772256863)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:41 -08:00 (1772313401)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that exercise the three defensive guards in UnifiedWrapper
 *               that are unreachable through normal slothlet API usage.
 * @module tests/vitests/suites/handlers/unified-wrapper-brand-check.test.vitest
 *
 * @description
 * Imports `UnifiedWrapper` directly via `@cldmv/slothlet/handlers/unified-wrapper`
 * to call the static/prototype methods in ways the normal proxy API never does.
 *
 * **Guard 1 — `____slothletInternal` brand check**
 *   `if (!(#internal in this)) return undefined;`
 *   Crash scenario: `UnifiedWrapper.prototype.____slothletInternal` — the
 *   prototype was never constructed, so `#internal` is absent. Without the
 *   guard this throws `TypeError: Cannot read private member from an object
 *   whose class did not declare it`. Node.js util.inspect walks prototype
 *   chains and can trigger this.
 *
 * **Guard 2 — `_extractFullImpl` null wrapper check**
 *   `if (!wrapper) return null;`
 *   Defensive: the static method is callable from anywhere with any argument.
 *   Passing null/undefined/false must not crash.
 *
 * **Guard 3 — `_extractFullImpl` primitive impl check**
 *   `if (typeof impl !== "object" && typeof impl !== "function") return impl;`
 *   Real scenario: a module whose default export is a primitive
 *   (`export default "v1.0.0"`, `export default 42`). Without this guard
 *   `Object.keys(impl)` on a string/number would iterate char indices
 *   instead of returning the primitive as-is.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { inspect } from "util";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Guard 1: brand check — direct prototype access ──────────────────────────

describe("UnifiedWrapper > ____slothletInternal brand check (Guard 1 — direct)", () => {
	test("accessing getter on UnifiedWrapper.prototype returns undefined without throwing", () => {
		// UnifiedWrapper.prototype was never constructed — it has no #internal field.
		// Without the brand check this throws:
		//   TypeError: Cannot read private member from an object whose class did not declare it
		let result;
		expect(() => {
			result = UnifiedWrapper.prototype.____slothletInternal;
		}).not.toThrow();

		expect(result).toBeUndefined();
	});

	test("accessing getter on Object.create(UnifiedWrapper.prototype) returns undefined without throwing", () => {
		// Same scenario via a bare object that inherits from the prototype
		// without ever going through the constructor.
		const bare = Object.create(UnifiedWrapper.prototype);
		let result;
		expect(() => {
			result = bare.____slothletInternal;
		}).not.toThrow();

		expect(result).toBeUndefined();
	});
});

// ─── Guard 1: brand check — via real proxy (util.inspect, getPrototypeOf) ────

describe.each(getMatrixConfigs())(
	"UnifiedWrapper > ____slothletInternal brand check (Guard 1 — via proxy) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST });
		});

		afterEach(async () => {
			await api?.shutdown?.();
		});

		test("util.inspect on a proxy does not throw (exercises prototype getter indirectly)", () => {
			// util.inspect internally walks prototype chains via Object.getPrototypeOf,
			// which may invoke the ____slothletInternal getter with the prototype as receiver.
			expect(() => {
				inspect(api.math, { depth: 2 });
			}).not.toThrow();
		});

		test("Object.getPrototypeOf on a real proxy returns null without throwing", () => {
			// The createProxy() getPrototypeOf trap returns null.
			// Confirms the trap fires correctly without hitting the brand-check crash.
			const proto = Object.getPrototypeOf(api.math);
			expect(proto).toBeNull();
		});
	}
);

// ─── Guard 2: _extractFullImpl null/falsy wrapper check ──────────────────────

describe("UnifiedWrapper._extractFullImpl > null/falsy wrapper guard (Guard 2)", () => {
	test("_extractFullImpl(null) returns null without throwing", () => {
		const result = UnifiedWrapper._extractFullImpl(null);
		expect(result).toBeNull();
	});

	test("_extractFullImpl(undefined) returns null without throwing", () => {
		const result = UnifiedWrapper._extractFullImpl(undefined);
		expect(result).toBeNull();
	});

	test("_extractFullImpl(false) returns null without throwing", () => {
		const result = UnifiedWrapper._extractFullImpl(false);
		expect(result).toBeNull();
	});

	test("_extractFullImpl(0) returns null without throwing", () => {
		const result = UnifiedWrapper._extractFullImpl(0);
		expect(result).toBeNull();
	});
});

// ─── Guard 3: _extractFullImpl primitive impl check ──────────────────────────

describe("UnifiedWrapper._extractFullImpl > primitive impl guard (Guard 3)", () => {
	// Build a minimal fake wrapper — the same shape _extractFullImpl expects.
	// This mirrors what happens when a module does `export default "v1.0.0"`.
	function makeFakeWrapper(impl) {
		return { ____slothletInternal: { impl } };
	}

	test("string impl is returned directly without iterating characters", () => {
		// Without Guard 3, Object.keys("v1.0.0") would silently return char
		// indices ("0","1",...) and the string would be reconstructed wrong.
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper("v1.0.0"));
		expect(result).toBe("v1.0.0");
	});

	test("number impl is returned directly", () => {
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper(42));
		expect(result).toBe(42);
	});

	test("boolean impl is returned directly", () => {
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper(true));
		expect(result).toBe(true);
	});

	test("null impl is returned directly (Guard 2b — impl null check)", () => {
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper(null));
		expect(result).toBeNull();
	});

	test("undefined impl is returned directly", () => {
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper(undefined));
		expect(result).toBeUndefined();
	});

	test("function impl is returned directly (function short-circuit)", () => {
		const fn = () => "hello";
		const result = UnifiedWrapper._extractFullImpl(makeFakeWrapper(fn));
		expect(result).toBe(fn);
	});
});
