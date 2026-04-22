/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/pattern-matcher-branches.test.vitest.mjs
 *	@Date: 2026-04-15 00:00:00 -07:00 (1776210000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-15 00:00:00 -07:00 (1776210000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for pattern-matcher branches.
 *
 * @description
 * Covers two branches not exercised by the integration suite:
 *
 * - `expandBraces` with `options.onMaxDepth` supplied — the happy path where the
 *   caller-provided handler is invoked when max depth is exceeded.
 * - `expandBraces` without `options.onMaxDepth` — the fallback throw path where
 *   `SlothletError("BRACE_EXPANSION_MAX_DEPTH")` is thrown directly.
 *
 * In normal usage (HookManager, PermissionManager) `onMaxDepth` is always supplied
 * and throws before the fallback, so the bare-throw branch is only reachable when
 * callers omit the option.
 *
 * @module tests/vitests/suites/helpers/pattern-matcher-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { expandBraces } from "@cldmv/slothlet/helpers/pattern-matcher";

describe("pattern-matcher > expandBraces depth limit", () => {
	it("calls onMaxDepth callback when depth equals maxDepth", () => {
		let called = false;
		const onMaxDepth = () => {
			called = true;
			throw new Error("max depth hit");
		};

		expect(() => expandBraces("{a,{b,{c}}}", 10, 10, { onMaxDepth })).toThrow("max depth hit");
		expect(called).toBe(true);
	});

	it("throws SlothletError BRACE_EXPANSION_MAX_DEPTH when no onMaxDepth is supplied", () => {
		// Call with depth already at maxDepth and no onMaxDepth option — hits the fallback throw.
		expect(() => expandBraces("{a,b}", 10, 10)).toThrow("BRACE_EXPANSION_MAX_DEPTH");
	});
});
