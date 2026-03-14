/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-runtime-introspection.test.vitest.mjs
 *	@Date: 2026-02-23T20:21:51-08:00 (1771906911)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:53 -08:00 (1772425313)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for runtime introspection APIs: self(), caller(), and get().
 *
 * These are the metadata APIs called FROM WITHIN a slothlet execution context:
 * - api.slothlet.metadata.self()   - metadata of the currently executing function
 * - api.slothlet.metadata.caller() - metadata of the function that invoked the current one
 * - api.slothlet.metadata.get(path) - metadata for any function by dot-notation path
 *
 * Tests verify:
 * - caller() returns null when no tracked slothlet caller is in context
 * - caller() returns the caller's system metadata in a slothlet→slothlet call chain
 * - self() throws RUNTIME_NO_ACTIVE_CONTEXT when called outside any slothlet context
 *
 * @module tests/vitests/suites/metadata/metadata-runtime-introspection.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata Runtime Introspection > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	// ─── caller() ──────────────────────────────────────────────────────────────

	describe("caller() - no tracked slothlet caller", () => {
		it("returns null when invoked directly (test is not a slothlet function)", async () => {
			// callerTest.getCallerMeta calls self.slothlet.metadata.caller()
			// The test itself is not a slothlet function, so callerWrapper is never set
			await materialize(api, "callerTest.getCallerMeta");
			const result = api.callerTest.getCallerMeta();

			expect(result).toBeNull();
		});
	});

	describe("caller() - with tracked slothlet caller", () => {
		it("returns the calling function's system metadata", async () => {
			// invokeCallerTest() is a slothlet function that calls self.callerTest.getCallerMeta()
			// When getCallerMeta executes, callerWrapper = invokeCallerTest's wrapper
			// So caller() returns metadata of invokeCallerTest (from metadata-test-helper.mjs)
			const result = await api.metadataTestHelper.invokeCallerTest();

			expect(result).not.toBeNull();
			expect(result.moduleID).toBeDefined();
			expect(result.filePath).toContain("metadata-test-helper");
		});

		it("caller metadata contains apiPath pointing to the invoking function", async () => {
			const result = await api.metadataTestHelper.invokeCallerTest();

			expect(result).not.toBeNull();
			expect(result.apiPath).toBeDefined();
			expect(result.apiPath).toContain("metadataTestHelper");
		});

		it("caller metadata is distinct from the callee's own metadata", async () => {
			// callerTest.getCallerMeta's own metadata would reference caller-test.mjs
			// But caller() returns invokeCallerTest's metadata which references metadata-test-helper.mjs
			const result = await api.metadataTestHelper.invokeCallerTest();

			expect(result).not.toBeNull();
			expect(result.filePath).not.toContain("caller-test");
		});
	});

	// ─── get() edge cases ────────────────────────────────────────────────────

	describe("get() - non-string path throws INVALID_ARGUMENT", () => {
		it("throws when passed a number", async () => {
			await expect(api.slothlet.metadata.get(123)).rejects.toThrow();
		});

		it("throws when passed null", async () => {
			await expect(api.slothlet.metadata.get(null)).rejects.toThrow();
		});
	});

	describe("get() - returns null for non-function resolved target", () => {
		it("returns null when path resolves to undefined (unknown property)", async () => {
			// rootMath.nonExistent is undefined in all modes — neither a function
			// nor a wrapper with impl, so get() returns null at the final guard
			const result = await api.slothlet.metadata.get("rootMath.nonExistent");
			expect(result).toBeNull();
		});
	});

	// ─── self() ────────────────────────────────────────────────────────────────

	describe("self() - called outside any slothlet context", () => {
		it("throws RUNTIME_NO_ACTIVE_CONTEXT when called from test scope", () => {
			// api.slothlet.metadata.self() is a plain closure — not a slothlet wrapper
			// Calling it from outside any execution context must throw
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.self()).toThrow();
			});
		});

		it("thrown error message references metadata.self()", () => {
			let caught;
			withSuppressedSlothletErrorOutputSync(() => {
				try {
					api.slothlet.metadata.self();
				} catch (e) {
					caught = e;
				}
			});
			expect(caught).toBeDefined();
			// SlothletError includes the hint about calling self() inside a slothlet function
			expect(caught.message ?? caught.toString()).toMatch(/self|context|active/i);
		});
	});
});
