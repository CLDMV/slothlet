/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/root-function.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 09:28:55 -07:00 (1761150535)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level function exports for greeting functionality. Internal file (not exported in package.json).
 * @module api_test.rootFunction
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Greets a name (default export).
 * This is the main callable API function.
 * Accessed as `api()` in the slothlet API.
 * @function greet
 * @alias module:api_test
 * @public
 * @param {string} name - Name to greet
 * @returns {string} Greeting message
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test("World")); // 'Hello, World!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test("World")); // 'Hello, World!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test("World")); // 'Hello, World!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test("World")); // 'Hello, World!'
 */
export default function greet(name) {
	return `Hello, ${name}!`;
}

/**
 * Shouts a greeting with uppercase formatting.
 * Accessed as `api.rootFunctionShout()` in the slothlet API.
 * @function rootFunctionShout
 * @memberof module:api_test
 * @public
 * @param {string} name - Name to greet loudly
 * @returns {string} Uppercase greeting message
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
 */
export function rootFunctionShout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}

/**
 * Whispers a greeting with lowercase formatting.
 * Accessed as `api.rootFunctionWhisper()` in the slothlet API.
 * @function rootFunctionWhisper
 * @memberof module:api_test
 * @public
 * @param {string} name - Name to greet quietly
 * @returns {string} Lowercase greeting message
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
 */
export function rootFunctionWhisper(name) {
	return `hello, ${name.toLowerCase()}.`;
}
