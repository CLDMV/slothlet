/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-replacement.test.vitest.mjs
 *	@Date: 2026-01-15T14:07:12-08:00 (1768514832)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:58 -08:00 (1770266398)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test cross-module ownership tracking with hot reload rollback support
 * @description Verifies that when module v2 overwrites module v1's function,
 *              ownership accumulates (both v1 and v2 tracked) to enable rollback.
 *              When v2 is removed, v1's function should be restored. When v1 is removed,
 *              core's original function should be restored if it existed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";

// Use all configurations - ownership tracking is now always available via api.slothlet.api

describe("Ownership Tracking on Cross-Module Replacement", () => {
	beforeAll(() => {
		// Enable internal test mode to expose ownership tracking methods
		process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";
	});

	afterAll(() => {
		// Clean up environment variable
		delete process.env.SLOTHLET_INTERNAL_TEST_MODE;
	});

	getMatrixConfigs().forEach(({ name, config }) => {
		describe.sequential(name, () => {
			it("should track full rollback chain: core → v1 → v2 → v1 → core", async () => {
				// Create unique temp directory for this specific test
				const tempBase = mkdtempSync(join(tmpdir(), "slothlet-ownership-test-"));
				const coreDir = join(tempBase, "core");
				const v1Dir = join(tempBase, "v1");
				const v2Dir = join(tempBase, "v2");

				try {
					// Create core module with a function (this will be the base API)
					mkdirSync(coreDir, { recursive: true });
					writeFileSync(join(coreDir, "feature.mjs"), 'export function doSomething() { return "core-implementation"; }');

					// Create v1 module with same function (different implementation)
					mkdirSync(v1Dir, { recursive: true });
					writeFileSync(join(v1Dir, "feature.mjs"), 'export function doSomething() { return "v1-implementation"; }');

					// Create v2 module with same function (different implementation)
					mkdirSync(v2Dir, { recursive: true });
					writeFileSync(join(v2Dir, "feature.mjs"), 'export function doSomething() { return "v2-implementation"; }');

					// Initialize slothlet with core API first
					const mergedConfig = {
						...config,
						dir: coreDir, // Start with core directory
						api: { collision: { api: "replace" } } // Enable replacement for ownership tracking
					};
					const api = await slothlet(mergedConfig);

					// Verify core loaded correctly
					expect(api.feature).toBeDefined();
					expect(api.feature.doSomething).toBeDefined();
					expect(await api.feature.doSomething()).toBe("core-implementation");

					// Check initial ownership - should be "base_slothlet" (generated base moduleId)
					const initialOwnership = api.slothlet.owner.get("feature");
					expect(initialOwnership).toBeDefined();
					expect(initialOwnership.size).toBe(1);
					// Ownership contains generated base_* moduleId (not "base" to avoid user conflicts)
					const baseModuleId = [...initialOwnership][0];
					expect(baseModuleId).toMatch(/^base_/);

					// Load v1 with moduleId (overwrites core)
					// Use root-level addition ("") so feature.mjs creates api.feature directly
					await api.slothlet.api.add("", v1Dir, {}, { moduleId: "module-v1" });

					// Verify v1 replaced core's implementation
					expect(await api.feature.doSomething()).toBe("v1-implementation");

					// Check ownership - should accumulate: base_* + v1 (v1 is current)
					const ownershipAfterV1 = api.slothlet.owner.get("feature");
					expect(ownershipAfterV1.size).toBe(2);
					expect(ownershipAfterV1.has(baseModuleId)).toBe(true);
					expect(ownershipAfterV1.has("module-v1")).toBe(true);
					// Current owner is last in stack (most recent)
					expect([...ownershipAfterV1].pop()).toBe("module-v1");

					// Load v2 with different moduleId (cross-module overwrite)
					await api.slothlet.api.add("", v2Dir, {}, { moduleId: "module-v2" });

					// Verify v2 replaced v1's implementation
					expect(await api.feature.doSomething()).toBe("v2-implementation");

					// Check ownership - should accumulate: base_* + v1 + v2 (v2 is current)
					const ownershipAfterV2 = api.slothlet.owner.get("feature");
					expect(ownershipAfterV2.size).toBe(3);
					expect(ownershipAfterV2.has(baseModuleId)).toBe(true);
					expect(ownershipAfterV2.has("module-v1")).toBe(true);
					expect(ownershipAfterV2.has("module-v2")).toBe(true);
					// Current owner is last in stack (most recent)
					expect([...ownershipAfterV2].pop()).toBe("module-v2");

					// Remove v2 - should rollback to v1
					await api.slothlet.api.remove("module-v2");

					// Verify rollback to v1
					expect(await api.feature.doSomething()).toBe("v1-implementation");
					const ownershipAfterV2Removed = api.slothlet.owner.get("feature");
					expect(ownershipAfterV2Removed.size).toBe(2);
					expect(ownershipAfterV2Removed.has(baseModuleId)).toBe(true);
					expect(ownershipAfterV2Removed.has("module-v1")).toBe(true);
					// Current owner is last in stack (most recent)
					expect([...ownershipAfterV2Removed].pop()).toBe("module-v1");

					// Remove v1 - should rollback to core
					await api.slothlet.api.remove("module-v1");

					// Verify rollback to base
					expect(await api.feature.doSomething()).toBe("core-implementation");
					const finalOwnership = api.slothlet.owner.get("feature");
					expect(finalOwnership.size).toBe(1);
					expect(finalOwnership.has(baseModuleId)).toBe(true);
					// Current owner is last in stack (most recent)
					expect([...finalOwnership].pop()).toBe(baseModuleId);

					await api.shutdown();
				} finally {
					// Cleanup module directories
					try {
						rmSync(coreDir, { recursive: true, force: true });
						rmSync(v1Dir, { recursive: true, force: true });
						rmSync(v2Dir, { recursive: true, force: true });
					} catch (_) {
						// Ignore cleanup errors
					}
				}
			});

			it("should accumulate ownership when v2 overwrites v1's function (hot reload rollback)", async () => {
				// Create unique temp directory for this specific test
				const tempBase = mkdtempSync(join(tmpdir(), "slothlet-ownership-test-"));
				const v1Dir = join(tempBase, "v1");
				const v2Dir = join(tempBase, "v2");

				try {
					// Create v1 module with a function
					mkdirSync(v1Dir, { recursive: true });
					writeFileSync(join(v1Dir, "feature.mjs"), 'export function doSomething() { return "v1-implementation"; }');

					// Create v2 module with same function (different implementation)
					mkdirSync(v2Dir, { recursive: true });
					writeFileSync(join(v2Dir, "feature.mjs"), 'export function doSomething() { return "v2-implementation"; }');

					// Initialize slothlet with matrix config + test-specific overrides
					const mergedConfig = {
						...config,
						dir: tempBase, // Use unique temp directory instead of shared api_tests/api_test
						api: { collision: { api: "replace" } } // Enable replacement for ownership tracking
					};
					const api = await slothlet(mergedConfig);

					// Load v1 with moduleId
					await api.slothlet.api.add("test", v1Dir, {}, { moduleId: "module-v1" });

					// Verify v1 loaded correctly (path is test.feature.doSomething due to filename)
					expect(api.test).toBeDefined();
					expect(api.test.feature).toBeDefined();
					expect(api.test.feature.doSomething).toBeDefined();
					expect(await api.test.feature.doSomething()).toBe("v1-implementation");

					// Check ownership - should only be v1
					const ownershipAfterV1 = api.slothlet.owner.get("test");
					expect(ownershipAfterV1.has("module-v1")).toBe(true);

					// Load v2 with different moduleId (cross-module overwrite)
					await api.slothlet.api.add("test", v2Dir, {}, { moduleId: "module-v2" });

					// Verify v2 replaced v1's implementation
					expect(api.test.feature).toBeDefined();
					expect(api.test.feature.doSomething).toBeDefined();
					expect(await api.test.feature.doSomething()).toBe("v2-implementation");

					// CORRECTED: Ownership should accumulate for hot reload rollback support
					// When v2 overwrites v1, both should be tracked so v1 can be restored if v2 is removed
					const ownershipAfterV2 = api.slothlet.owner.get("test");
					expect(ownershipAfterV2).toBeDefined();
					expect(ownershipAfterV2.size).toBe(2); // Both v1 and v2 should be tracked
					expect(ownershipAfterV2.has("module-v2")).toBe(true);
					expect(ownershipAfterV2.has("module-v1")).toBe(true); // v1 remains for rollback

					await api.shutdown();
				} finally {
					// Cleanup module directories
					try {
						rmSync(v1Dir, { recursive: true, force: true });
						rmSync(v2Dir, { recursive: true, force: true });
					} catch (_) {
						// Ignore
					}
				}
			});

			it("should preserve shared ownership when merging properties (not replacing)", async () => {
				// Create unique temp directory for this specific test
				const tempBase = mkdtempSync(join(tmpdir(), "slothlet-ownership-test-"));
				const v1Dir = join(tempBase, "merge_v1");
				const v2Dir = join(tempBase, "merge_v2");

				try {
					// Create v1 module with object property A
					mkdirSync(v1Dir, { recursive: true });
					writeFileSync(join(v1Dir, "config.mjs"), 'export const config = { propertyA: "from-v1" };');

					// Create v2 module with object property B (different property, not replacing)
					mkdirSync(v2Dir, { recursive: true });
					writeFileSync(join(v2Dir, "config.mjs"), 'export const config = { propertyB: "from-v2" };');

					// Initialize slothlet with matrix config + test-specific overrides
					const mergedConfig = {
						...config,
						dir: tempBase, // Use unique temp directory instead of shared api_tests/api_test
						api: { collision: { api: "merge" } } // Use merge mode - different properties coexist
					};
					const api = await slothlet(mergedConfig);

					// Load both modules (merge mode - different properties should coexist)
					await api.slothlet.api.add("merged", v1Dir, {}, { moduleId: "module-v1" });
					await api.slothlet.api.add("merged", v2Dir, {}, { moduleId: "module-v2" });

					// Check ownership - both should be owners since they contribute different properties
					// Ownership is registered at the API path level (merged)
					const ownership = api.slothlet.owner.get("merged");
					expect(ownership.size).toBe(2);
					expect(ownership.has("module-v1")).toBe(true);
					expect(ownership.has("module-v2")).toBe(true);

					await api.shutdown();
				} finally {
					// Cleanup module directories
					try {
						rmSync(v1Dir, { recursive: true, force: true });
						rmSync(v2Dir, { recursive: true, force: true });
					} catch (_) {
						// Ignore
					}
				}
			});
		});
	});
});
