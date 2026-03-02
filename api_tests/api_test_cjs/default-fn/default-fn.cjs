/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_cjs/default-fn/default-fn.cjs
 *	@Date: 2026-03-01T22:00:00-08:00 (1772427600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 22:00:00 -08:00 (1772427600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CJS fixture that exports `{ default: fn }` with NO named exports.
 *
 * When loaded via dynamic `import()`, Node wraps CJS exports as:
 *   `{ default: module.exports }` = `{ default: { default: fn } }`
 *
 * Because there are NO named exports beside `default`, the extractExports
 * "CJS unwrap" logic does NOT fire (defaultKeys.length === 0), so the final
 * `impl` stored in the lazy wrapper becomes `{ default: fn }`.
 *
 * This creates the exact scenario needed to exercise:
 *   - `__type`      branch: `impl && typeof impl === "object" && typeof impl.default === "function"` → "function"
 *   - `[Symbol.toStringTag]` same branch                                                           → "Function"
 *   - `.length`     same branch → `impl.default.length`
 *   - `.toString`   same branch → `impl.default.toString.bind(impl.default)`
 *   - `.valueOf`    same branch → `impl.default.valueOf.bind(impl.default)`
 *
 * @module api_test_cjs.defaultFn
 * @internal
 */

/**
 * A simple multiply function used as the default export.
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {number} Product of a and b.
 * @example
 * multiply(3, 4); // 12
 */
function multiply(a, b) {
	return a * b;
}

// Intentionally export as { default: fn } with NO additional named exports.
// This prevents the extractExports CJS-unwrap heuristic from firing.
module.exports = { default: multiply };
