/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/type-generator-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 07:33:53 -08:00 (1772552033)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for traverseAPI — circular reference guard (line 116).
 *
 * @description
 * `traverseAPI` uses a `visited` Set to prevent infinite loops when the API object
 * contains circular references.  Line 116 is the early-return guard:
 *
 *   if (visited.has(api)) { return nodes; }
 *
 * `traverseAPI` is a private function, exercised via the public `generateTypes` export.
 * Passing an API object with a self-referencing property (`api.self = api`) forces
 * `traverseAPI` to recurse into the same object reference, hitting line 116.
 *
 * @module tests/vitests/suites/typescript/type-generator-branches.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { generateTypes } from "@cldmv/slothlet/processors/type-generator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Temp output file in project tmp/ dir (never /tmp). */
const OUTPUT_PATH = path.resolve(__dirname, "../../../../tmp/type-gen-test.d.ts");

afterEach(() => {
	if (fs.existsSync(OUTPUT_PATH)) {
		fs.unlinkSync(OUTPUT_PATH);
	}
});

// ─── traverseAPI — circular reference guard (line 116) ───────────────────────

describe("generateTypes / traverseAPI — circular reference guard (line 116)", () => {
	it("generates types without infinite-looping when API has a circular reference (line 116)", async () => {
		/**
		 * Minimal API function for type generation.
		 * @param {number} a - First number.
		 * @param {number} b - Second number.
		 * @returns {number} Sum.
		 */
		function add(a, b) {
			return a + b;
		}

		const api = { math: { add } };
		// Introduce circular reference — traverseAPI will encounter api again and
		// hit line 116 before infinite-recursing.
		api.self = api;

		const result = await generateTypes(api, {
			output: OUTPUT_PATH,
			interfaceName: "TestCircularAPI"
		});

		// Must complete without throwing
		expect(result).toBeDefined();
		expect(result.output).toContain("TestCircularAPI");
		expect(fs.existsSync(OUTPUT_PATH)).toBe(true);
	});

	it("generates types for a flat API without circular refs (baseline, no line 116)", async () => {
		/**
		 * Simple greet function.
		 * @param {string} name - Greeting target.
		 * @returns {string} Greeting message.
		 */
		function greet(name) {
			return `Hello, ${name}`;
		}

		const api = { utils: { greet } };

		const result = await generateTypes(api, {
			output: OUTPUT_PATH,
			interfaceName: "TestFlatAPI"
		});

		expect(result).toBeDefined();
		expect(result.output).toContain("TestFlatAPI");
	});
});
// ─── traverseAPI — non-object input early-return guard (line 116) ─────────────

describe("generateTypes / traverseAPI — non-object api guard (line 116)", () => {
	/**
	 * `traverseAPI` checks `!api || typeof api !== "object"` as its first guard (line 115).
	 * Passing `null` as the top-level api causes the guard to be true on the very first call,
	 * executing the `return nodes` at line 116 and returning an empty declaration.
	 */
	it("returns gracefully when api is null — hits early-return guard (line 116)", async () => {
		// null top-level api → traverseAPI(!api) → true → line 116 `return nodes`
		const result = await generateTypes(null, { output: OUTPUT_PATH, interfaceName: "NullApi" });
		expect(result).toBeDefined();
		// Should produce a valid (possibly empty) output without throwing
		expect(typeof result.output).toBe("string");
	});

	it("returns gracefully when api is a plain string \u2014 hits typeof guard (line 116)", async () => {
		// typeof 'notAnObject' !== 'object' \u2192 line 116
		const result = await generateTypes("notAnObject", { output: OUTPUT_PATH, interfaceName: "StrApi" });
		expect(result).toBeDefined();
		expect(typeof result.output).toBe("string");
	});
});
