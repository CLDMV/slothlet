/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/platform-browser-variant.test.vitest.mjs
 *	@Date: 2026-11-27T21:57:04-08:00 (1795845424)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:51-08:00 (1795869111)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #1034 — `#helpers/platform`'s browser file, where the page has a Node `process` (an Electron renderer
 * with Node integration built for the browser), hands out Node's builtins as the Node file does.
 *
 * @description
 * The browser file is imported by its own name, since Node resolves `#helpers/platform` to the Node file. The vitest browser
 * run covers the stand-ins it hands out in a real browser (`tests/browser/platform.browser.test.mjs`).
 *
 * @module tests/vitests/suites/helpers/platform-browser-variant
 */

import { describe, it, expect } from "vitest";
import * as nodePlatform from "#helpers/platform";
import * as browserPlatform from "#helpers/platform.browser";
import { generateImportMap } from "#helpers/generate-manifest";

describe("#helpers/platform browser file with a Node process (#1034)", () => {
	it("reports the host as Node", () => {
		expect(browserPlatform.isNode).toBe(true);
	});

	it("hands out Node's builtins", () => {
		expect(typeof browserPlatform.fs.readFileSync).toBe("function");
		expect(typeof browserPlatform.fsp.readFile).toBe("function");
		expect(typeof browserPlatform.path.join).toBe("function");
		expect(typeof browserPlatform.url.fileURLToPath).toBe("function");
		expect(typeof browserPlatform.util.types.isProxy).toBe("function");
		expect(typeof browserPlatform.EventEmitter).toBe("function");
		expect(typeof browserPlatform.AsyncLocalStorage).toBe("function");
		expect(typeof browserPlatform.createRequire).toBe("function");
		expect(typeof browserPlatform.vm.compileFunction).toBe("function");
		expect(typeof browserPlatform.childProcess.fork).toBe("function");
	});

	it("shares one set of values with the Node file", () => {
		for (const name of Object.keys(nodePlatform)) expect(browserPlatform[name]).toBe(nodePlatform[name]);
		expect(Object.keys(browserPlatform).sort()).toEqual(Object.keys(nodePlatform).sort());
	});

	it("is the file a browser's importmap maps `#helpers/platform` to", async () => {
		const { imports, scopes } = await generateImportMap("/");
		const mapped = [imports, ...Object.values(scopes)].map((map) => map["#helpers/platform"]).filter(Boolean);
		expect(mapped.length).toBeGreaterThan(0);
		for (const url of mapped) expect(url).toMatch(/\/lib\/helpers\/platform\.browser\.mjs$/);
	});
});
