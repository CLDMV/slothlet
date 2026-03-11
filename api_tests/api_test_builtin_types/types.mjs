/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_builtin_types/types.mjs
 *	@Date: 2026-02-27T21:34:23-08:00 (1772256863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:12 -08:00 (1772425272)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture that exports built-in object types.
 * Used to test that the unified-wrapper getTrap returns these directly without wrapping them in a child proxy.
 * @module api_test_builtin_types.types
 * @memberof module:api_test_builtin_types
 */

export const myMap = new Map([
	["alpha", 1],
	["beta", 2]
]);

export const mySet = new Set([10, 20, 30]);

export const myDate = new Date("2024-06-01T00:00:00.000Z");

export const myRegex = /slothlet/gi;

export const myError = new Error("fixture error");

export const myBuffer = new ArrayBuffer(16);

export const myFloat32 = new Float32Array([1.1, 2.2, 3.3]);

export const myWeakMap = new WeakMap();

export const myWeakSet = new WeakSet();

/** A plain async function to confirm that a normal callable also works in the same module. */
export async function getVersion() {
	return "1.0.0";
}
