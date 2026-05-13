/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-runtime-self.test.vitest.mjs
 *	@Date: 2026-05-12 06:10:06 -07:00 (1778591406)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 06:15:05 -07:00 (1778591705)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression test for `import { self } from "@cldmv/slothlet/runtime"` in TS modules.
 *
 * Prior to 3.4.2, slothlet loaded transformed TS via `data:` URLs. Node's ESM
 * resolver cannot anchor bare-specifier or relative-path resolution at a
 * `data:` URL base, so any import inside a `.ts`/`.mts` module would fail.
 * The fix writes transformed code to a project-local cache file and loads it
 * via `pathToFileURL`, mirroring the working `.mjs` branch.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

describe("TypeScript runtime self import (regression)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("resolves @cldmv/slothlet/runtime from a .ts module (fast mode)", async () => {
		api = await slothlet({
			dir: "./api_tests/api_test_typescript_runtime",
			typescript: "fast"
		});

		expect(api.foo.ping()).toBe("pong");
		await expect(api.bar.call()).resolves.toBe("pong");
	});

	it("resolves @cldmv/slothlet/runtime from a .ts module in eager mode", async () => {
		api = await slothlet({
			dir: "./api_tests/api_test_typescript_runtime",
			mode: "eager",
			typescript: true
		});

		expect(api.foo.ping()).toBe("pong");
		await expect(api.bar.call()).resolves.toBe("pong");
	});

	it("resolves @cldmv/slothlet/runtime from a .mts module (fast mode)", async () => {
		api = await slothlet({
			dir: "./api_tests/api_test_typescript_runtime",
			typescript: "fast"
		});

		// baz.mts imports `self` and `instanceID` from @cldmv/slothlet/runtime
		// and calls into bar.ts (which itself imports self) — proves both
		// .mts source loading and a .mts → .ts cross-module call work.
		const result = await api.baz.chain();
		expect(result).toMatch(/:pong$/);
		expect(result.length).toBeGreaterThan("pong".length + 1);
	});

	it("resolves @cldmv/slothlet/runtime from a .mts module in eager mode", async () => {
		api = await slothlet({
			dir: "./api_tests/api_test_typescript_runtime",
			mode: "eager",
			typescript: true
		});

		const result = await api.baz.chain();
		expect(result).toMatch(/:pong$/);
	});
});
