/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/init.browser.test.mjs
 *	@Date: 2026-06-16T19:29:13-07:00 (1781663353)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 17:07:57 -07:00 (1782086877)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Minimal vitest browser-mode test — runs in a real headless Chromium. Importing
 * slothlet executes the module-init browser arms (e.g. platform isNode=false, translations_dirname
 * `: null`). Used to validate the browser→coverage pipeline before the full behavioral scenarios.
 */

import { describe, it, expect } from "vitest";

describe("slothlet loads in a real browser", () => {
	it("imports and exposes the slothlet entry", async () => {
		// Real browser env: no process.versions.node, so isNode is false and the !isNode
		// module-init arms execute.
		expect(typeof process === "undefined" || !process?.versions?.node).toBe(true);
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		expect(typeof slothlet).toBe("function");
	});

	it("loads the platform helper with isNode=false (executes the browser detection arm)", async () => {
		// Directly import a module that has browser-only arms so coverage can prove it maps to src.
		const platform = await import("@cldmv/slothlet/helpers/platform");
		expect(platform.isNode).toBe(false);
	});
});
