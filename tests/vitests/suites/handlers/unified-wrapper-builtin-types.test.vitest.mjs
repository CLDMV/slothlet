/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-builtin-types.test.vitest.mjs
 *	@Date: 2026-02-27T21:34:23-08:00 (1772256863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:48 -08:00 (1772425308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that built-in object types (Map, Set, Date, RegExp, etc.) exported from
 * an API module are returned directly by the getTrap without being wrapped in a child proxy.
 * @module tests/vitests/suites/handlers/unified-wrapper-builtin-types.test.vitest
 *
 * @description
 * Coverage targets in unified-wrapper.mjs:
 *
 * - getTrap builtin check (~lines 2440-2451): when `value instanceof Map|Set|WeakMap|WeakSet|
 *   Date|RegExp|Promise|Error|ArrayBuffer.isView|ArrayBuffer` → return value directly.
 * - ___createChildWrapper builtin check (~lines 1191-1202): same instanceof checks → return null
 *   so the unwrapped value is stored/returned without a child proxy wrapper.
 *
 * Both code paths are exercised by accessing these exports through a live slothlet instance.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the fixture folder: api_tests/api_test_builtin_types/
const BUILTIN_TYPES_DIR = path.resolve(__dirname, "../../../../api_tests/api_test_builtin_types");

// ─── Built-in type passthrough via getTrap ─────────────────────────────────────

describe.each(getMatrixConfigs())(
	"UnifiedWrapper > getTrap > built-in types returned directly (no child proxy) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: BUILTIN_TYPES_DIR });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("Map instance is returned directly (instanceof Map)", () => {
			const value = api.types.myMap;
			expect(value).toBeInstanceOf(Map);
		});

		test("Map instance has correct entries", () => {
			const value = api.types.myMap;
			expect(value.get("alpha")).toBe(1);
			expect(value.get("beta")).toBe(2);
		});

		test("Set instance is returned directly (instanceof Set)", () => {
			const value = api.types.mySet;
			expect(value).toBeInstanceOf(Set);
		});

		test("Set instance has .has() working", () => {
			const value = api.types.mySet;
			expect(value.has(20)).toBe(true);
			expect(value.has(99)).toBe(false);
		});

		test("Date instance is returned directly (instanceof Date)", () => {
			const value = api.types.myDate;
			expect(value).toBeInstanceOf(Date);
		});

		test("Date instance returns correct ISO string", () => {
			const value = api.types.myDate;
			expect(value.toISOString()).toBe("2024-06-01T00:00:00.000Z");
		});

		test("RegExp instance is returned directly (instanceof RegExp)", () => {
			const value = api.types.myRegex;
			expect(value).toBeInstanceOf(RegExp);
		});

		test("RegExp instance works as a pattern", () => {
			const value = api.types.myRegex;
			expect(value.test("slothlet")).toBe(true);
			expect(value.test("unrelated")).toBe(false);
		});

		test("Error instance is returned directly (instanceof Error)", () => {
			const value = api.types.myError;
			expect(value).toBeInstanceOf(Error);
		});

		test("Error instance has correct message", () => {
			const value = api.types.myError;
			expect(value.message).toBe("fixture error");
		});

		test("ArrayBuffer instance is returned directly (instanceof ArrayBuffer)", () => {
			const value = api.types.myBuffer;
			expect(value).toBeInstanceOf(ArrayBuffer);
		});

		test("ArrayBuffer has correct byteLength", () => {
			const value = api.types.myBuffer;
			expect(value.byteLength).toBe(16);
		});

		test("Float32Array (TypedArray) is returned directly (ArrayBuffer.isView)", () => {
			const value = api.types.myFloat32;
			expect(value).toBeInstanceOf(Float32Array);
			expect(ArrayBuffer.isView(value)).toBe(true);
		});

		test("Float32Array has correct values", () => {
			const value = api.types.myFloat32;
			expect(value[0]).toBeCloseTo(1.1);
			expect(value[1]).toBeCloseTo(2.2);
			expect(value[2]).toBeCloseTo(3.3);
		});

		test("WeakMap instance is returned directly (instanceof WeakMap)", () => {
			const value = api.types.myWeakMap;
			expect(value).toBeInstanceOf(WeakMap);
		});

		test("WeakSet instance is returned directly (instanceof WeakSet)", () => {
			const value = api.types.myWeakSet;
			expect(value).toBeInstanceOf(WeakSet);
		});
	}
);
