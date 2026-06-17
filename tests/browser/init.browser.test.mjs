/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/init.browser.test.mjs
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
