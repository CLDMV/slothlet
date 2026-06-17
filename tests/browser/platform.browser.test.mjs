/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/platform.browser.test.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Drives the browser-only arms of src/lib/helpers/platform.mjs in real Chromium:
 * isNode=false detection, the browser `util` shim (the module-init `else` arm), and loadJson's async
 * dynamic-import branch. The node coverage run can never take these arms (process is always present).
 */

import { describe, it, expect } from "vitest";

describe("platform browser host arms", () => {
	it("detects browser host + installs the util shim", async () => {
		const platform = await import("@cldmv/slothlet/helpers/platform");
		// Module-init: `const isNode = … process …` resolves false in a browser.
		expect(platform.isNode).toBe(false);
		// The `else` arm ran: util is the browser shim, not node:util.
		expect(typeof platform.util.inspect).toBe("function");
		expect(platform.util.inspect("x")).toBe("x"); // shim is identity
		expect(platform.util.types.isProxy({})).toBe(false); // shim always false
		// Node-only builtins are null in a browser.
		expect(platform.fs).toBe(null);
	});

	it("loadJson takes the async dynamic-import branch in a browser", async () => {
		const { loadJson } = await import("@cldmv/slothlet/helpers/platform");
		// In a browser loadJson returns a Promise (async import branch executes regardless of
		// whether the specifier ultimately resolves under the test's module server).
		const result = loadJson("@cldmv/slothlet/i18n/language/es-mx.json");
		expect(typeof result.then).toBe("function");
		const value = await result;
		expect(value === null || typeof value === "object").toBe(true);
	});
});
