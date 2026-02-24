/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-security.test.vitest.mjs
 *	@Date: 2026-02-23 00:00:00 -08:00 (1771891200)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-23 17:37:32 -08:00 (1771897052)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Security tests for tagSystemMetadata() and lifecycle payload hardening.
 *
 * Tests the two attack vectors patched in docs/v3-issues/tag-system-metadata-enforcement.md:
 *
 * 1. **tagSystemMetadata() token enforcement** — previously a plain `{ _fromLifecycle: true }`
 *    boolean flag that anyone could forge. Now enforced with a module-private Symbol
 *    (LIFECYCLE_TOKEN from lifecycle-token.mjs) that cannot be constructed from user-land.
 *
 * 2. **lifecycle payload wrapper leakage** — `data.wrapper` in impl:created / impl:changed
 *    payloads previously pointed to the raw UnifiedWrapper instance, which exposed
 *    `data.wrapper.slothlet` → the full internal slothlet object. Now `data.wrapper` is a
 *    frozen minimal object `{ __impl }` containing no internal references.
 *
 * @module tests/vitests/suites/metadata/metadata-security.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Attack vector 1: tagSystemMetadata() honor-system bypass
//
// Anyone with a reference to slothlet.handlers.metadata could previously call
// tagSystemMetadata(anyTarget, fakeData, { _fromLifecycle: true }) and forge
// system metadata. The fix replaces the options object with a module-private
// Symbol (LIFECYCLE_TOKEN) that cannot be constructed from outside the module.
// ---------------------------------------------------------------------------

describe("tagSystemMetadata() Token Enforcement (security)", () => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager"
		});
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
	});

	it("should reject calls with no token argument", async () => {
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" })).toThrow("METADATA_LIFECYCLE_BYPASS");
	});

	it("should reject the old honor-system { _fromLifecycle: true } options object", async () => {
		// This is the trivially-forgeable bypass that existed before the Symbol fix.
		// Passing this object must now throw since it is not === LIFECYCLE_TOKEN.
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, { _fromLifecycle: true })).toThrow(
			"METADATA_LIFECYCLE_BYPASS"
		);
	});

	it("should reject a newly constructed Symbol even with the same description", async () => {
		// Symbol() always produces a unique value — even Symbol("same description") !== Symbol("same description").
		// This confirms the check is identity-based, not description-based.
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};
		const forgedSymbol = Symbol("@cldmv/slothlet/lifecycle.tagToken"); // same description, different identity

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, forgedSymbol)).toThrow(
			"METADATA_LIFECYCLE_BYPASS"
		);
	});

	it("should reject a boolean true token", async () => {
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, true)).toThrow("METADATA_LIFECYCLE_BYPASS");
	});

	it("should reject a string token", async () => {
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, "lifecycle")).toThrow(
			"METADATA_LIFECYCLE_BYPASS"
		);
	});

	it("should reject null and undefined tokens", async () => {
		await materialize(api, "math.add", 1, 2);
		const metadataHandler = resolveWrapper(api.math).slothlet.handlers.metadata;
		const target = function fakeTarget() {};

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, null)).toThrow("METADATA_LIFECYCLE_BYPASS");

		expect(() => metadataHandler.tagSystemMetadata(target, { apiPath: "fake", moduleID: "x" }, undefined)).toThrow(
			"METADATA_LIFECYCLE_BYPASS"
		);
	});

	it("should confirm legitimate system metadata tagging still works end-to-end", async () => {
		// Verifies that the token mechanism doesn't break the actual internal flow.
		// If tagSystemMetadata() is being called correctly through lifecycle, metadata should be present.
		await materialize(api, "math.add", 1, 2);
		const meta = api.math.add.__metadata;

		expect(meta).toBeDefined();
		expect(meta.moduleID).toBeDefined();
		expect(meta.filePath).toBeDefined();
		expect(meta.apiPath).toBe("math.add");
	});
});

// ---------------------------------------------------------------------------
// Attack vector 2: lifecycle payload wrapper leakage
//
// Previously data.wrapper in impl:created / impl:changed payloads was the raw
// UnifiedWrapper instance, and data.wrapper.slothlet returned the full internal
// slothlet object (bypassing the proxy's get trap, which was not yet created
// at that point). This allowed any lifecycle subscriber to reach
// slothlet.handlers.lifecycle.emit() and bypass the token check entirely.
//
// Fix: data.wrapper is now Object.freeze({ __impl }) — a frozen minimal object
// with no reference to the internal slothlet instance.
// ---------------------------------------------------------------------------

describe.each(getMatrixConfigs())("Lifecycle Payload Hardening > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
	});

	describe("impl:created payload", () => {
		it("data.wrapper should not expose the internal slothlet instance", async () => {
			const capturedWrappers = [];

			api.slothlet.lifecycle.on("impl:created", (data) => {
				if (data.wrapper) capturedWrappers.push(data.wrapper);
			});

			// Adding a new API module fires impl:created for each wrapper created.
			await api.slothlet.api.add("securityTest", TEST_DIRS.API_TEST);

			expect(capturedWrappers.length).toBeGreaterThan(0);

			for (const wrapper of capturedWrappers) {
				// Core security assertion: no path to internal slothlet instance
				expect(wrapper.slothlet).toBeUndefined();
				expect(wrapper.handlers).toBeUndefined();
				expect(wrapper.____slothletInternal).toBeUndefined();
			}
		});

		it("data.wrapper should be a frozen object (immutable payload)", async () => {
			let capturedWrapper = null;

			api.slothlet.lifecycle.on("impl:created", (data) => {
				if (data.wrapper && !capturedWrapper) capturedWrapper = data.wrapper;
			});

			await api.slothlet.api.add("securityTest2", TEST_DIRS.API_TEST);

			expect(capturedWrapper).not.toBeNull();
			expect(Object.isFrozen(capturedWrapper)).toBe(true);
		});

		it("data.wrapper.__impl should still be accessible for ownership subscribers", async () => {
			// The internal ownership subscriber uses data.wrapper?.__impl to get the
			// actual implementation. This must remain accessible after the hardening.
			const wrapperSnapshots = [];

			api.slothlet.lifecycle.on("impl:created", (data) => {
				if (data.wrapper) {
					wrapperSnapshots.push({ hasImpl: "__impl" in data.wrapper });
				}
			});

			await api.slothlet.api.add("securityTest3", TEST_DIRS.API_TEST);

			expect(wrapperSnapshots.length).toBeGreaterThan(0);

			// At least some payloads will have __impl (those emitted for wrappers with loaded impls)
			const withImpl = wrapperSnapshots.filter((s) => s.hasImpl);
			expect(withImpl.length).toBeGreaterThan(0);
		});

		it("data.wrapper should only contain the expected minimal shape", async () => {
			const capturedWrappers = [];

			api.slothlet.lifecycle.on("impl:created", (data) => {
				if (data.wrapper) capturedWrappers.push(data.wrapper);
			});

			await api.slothlet.api.add("securityTest4", TEST_DIRS.API_TEST);

			expect(capturedWrappers.length).toBeGreaterThan(0);

			for (const wrapper of capturedWrappers) {
				const keys = Object.keys(wrapper);
				// The only own enumerable key should be __impl
				expect(keys).toEqual(["__impl"]);
			}
		});
	});

	describe("impl:changed payload", () => {
		it("data.wrapper should not expose the internal slothlet instance after reload", async () => {
			const capturedWrappers = [];

			api.slothlet.lifecycle.on("impl:changed", (data) => {
				if (data.wrapper) capturedWrappers.push(data.wrapper);
			});

			// Reload fires impl:changed for every module that gets a new impl.
			await api.slothlet.api.reload();

			if (capturedWrappers.length === 0) {
				// Some modes may not fire impl:changed on a straight reload if no diff — skip gracefully.
				return;
			}

			for (const wrapper of capturedWrappers) {
				expect(wrapper.slothlet).toBeUndefined();
				expect(wrapper.handlers).toBeUndefined();
				expect(wrapper.____slothletInternal).toBeUndefined();
			}
		});

		it("data.wrapper should be frozen in impl:changed payloads", async () => {
			let capturedWrapper = null;

			api.slothlet.lifecycle.on("impl:changed", (data) => {
				if (data.wrapper && !capturedWrapper) capturedWrapper = data.wrapper;
			});

			await api.slothlet.api.reload();

			if (!capturedWrapper) return; // No impl:changed fired — skip gracefully

			expect(Object.isFrozen(capturedWrapper)).toBe(true);
		});
	});
});
