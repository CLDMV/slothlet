/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/async-detection.browser.test.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The browser util shim's async-function detection honours the Node contract (#253).
 *
 * @description
 * Hook dispatch derives its per-call strategy from handler async-ness via
 * `util.types.isAsyncFunction`. In a browser the platform shim stands in for Node's native brand
 * check with a constructor-name test; a shim that answered differently would give the same hook
 * registration different dispatch strategies per host. Pinned here IN the browser host: a native
 * async function detects, a plain function does not (including the documented
 * returns-a-Promise blind spot, which declares `{ async: true }` instead), and a non-function
 * answers false rather than throwing.
 */

import { describe, it, expect } from "vitest";
import { util } from "@cldmv/slothlet/helpers/platform";

describe("browser platform shim > util.types.isAsyncFunction", () => {
	it("detects a native async function", () => {
		expect(util.types.isAsyncFunction(async () => {})).toBe(true);
	});

	it("treats plain functions as sync, including the returns-a-Promise blind spot", () => {
		expect(util.types.isAsyncFunction(() => {})).toBe(false);
		expect(util.types.isAsyncFunction(() => Promise.resolve(1))).toBe(false);
	});

	it("answers false for non-functions instead of throwing", () => {
		expect(util.types.isAsyncFunction(null)).toBe(false);
		expect(util.types.isAsyncFunction(42)).toBe(false);
	});
});
