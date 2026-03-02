/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reload-path-multicache.test.vitest.mjs
 *	@Date: 2026-02-10T06:29:29-08:00 (1770733769)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:47 -08:00 (1772425307)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for path-based reload with multiple contributing caches (Step 6).
 *
 * These tests verify that path-based reload (`api.slothlet.api.reload("endpoint")`)
 * correctly handles cases where multiple caches contribute to the same API path:
 * - Multiple modules added at the same endpoint are all rebuilt
 * - Load order is preserved (base first, then adds chronologically)
 * - The first cache uses forceReplace, subsequent caches use their original collision mode
 * - Child caches under a parent path are all rebuilt when reloading the parent
 * - Custom properties survive multi-cache reload
 * - Ownership stack is maintained through reload
 *
 * Runs across all 8 matrix configurations (eager/lazy × async/live × hooks on/off).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

for (const { config, name } of configs) {
	describe(`Path Reload with Multi-Cache Rebuild - ${name}`, () => {
		let slothlet;

		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;
		});

		// ─── 1. Same-endpoint multi-cache: both caches rebuilt ───

		describe("Same-Endpoint Multi-Cache Rebuild", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "merge"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should rebuild both caches when two modules share the same endpoint", async () => {
				// Add first module at "shared" endpoint
				const moduleID1 = await api.slothlet.api.add("shared", TEST_DIRS.API_TEST);

				// Verify first module's math works
				const math1 = await api.shared.math.add(2, 3);
				expect(math1).toBeDefined();

				// Add second module at same "shared" endpoint (merge mode)
				const moduleID2 = await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_COLLISIONS);

				// API_TEST_COLLISIONS exports merge into existing structure:
				// - collections: NEW top-level key → merges in
				// - math.power, math.sqrt, math.modulo: NEW keys → merge into existing math wrapper
				// - math.collisionVersion: exists in BOTH modules → merge preserves API_TEST's value
				expect(api.shared.collections).toBeDefined();
				const sharedPower = await api.shared.math.power(2, 3);
				expect(sharedPower).toBe(8);

				// Reload "shared" - should find both caches (exact endpoint match)
				await api.slothlet.api.reload("shared");

				// After reload, keys from both modules should still exist
				// because first module rebuilds with replace, second merges on top
				const mathAfter = await api.shared.math.add(2, 3);
				expect(mathAfter).toBeDefined();

				// Merged keys from API_TEST_COLLISIONS still present after reload
				expect(api.shared.collections).toBeDefined();
				const powerAfter = await api.shared.math.power(2, 3);
				expect(powerAfter).toBe(8);
			});

			it("should preserve keys from first module when second merges", async () => {
				// API_TEST has config.host - API_TEST_COLLISIONS does NOT
				await api.slothlet.api.add("merged", TEST_DIRS.API_TEST);

				// Verify API_TEST unique key exists
				const configHost = await api.merged.config.host;
				expect(configHost).toBe("https://slothlet");

				// Add collisions module at same endpoint (merge)
				await api.slothlet.api.add("merged", TEST_DIRS.API_TEST_COLLISIONS);

				// API_TEST_COLLISIONS merges: collections (new top-level), power/sqrt/modulo (new keys in math)
				expect(api.merged.collections).toBeDefined();
				const mergedPower = await api.merged.math.power(2, 4);
				expect(mergedPower).toBe(16);

				// Both unique keys should exist before reload
				expect(await api.merged.config.host).toBe("https://slothlet");

				// Reload "merged"
				await api.slothlet.api.reload("merged");

				// API_TEST unique keys still present (first rebuild, replace mode)
				const configAfter = await api.merged.config.host;
				expect(configAfter).toBe("https://slothlet");

				// API_TEST_COLLISIONS merged keys still present (second rebuild, merge mode)
				expect(api.merged.collections).toBeDefined();
				const powerAfter = await api.merged.math.power(2, 4);
				expect(powerAfter).toBe(16);
			});
		});

		// ─── 2. Load order: base first, then adds chronologically ───

		describe("Load Order Preservation", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "merge"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should rebuild caches in add-history order", async () => {
				// Add first module - provides math.add, config, etc.
				const moduleID1 = await api.slothlet.api.add("ordered", TEST_DIRS.API_TEST);

				// Add second module - provides collections (new top-level) and power/sqrt/modulo (merge into math)
				const moduleID2 = await api.slothlet.api.add("ordered", TEST_DIRS.API_TEST_COLLISIONS);

				// Merged keys from COLLISIONS present before reload
				expect(api.ordered.collections).toBeDefined();
				const orderedPower = await api.ordered.math.power(2, 3);
				expect(orderedPower).toBe(8);

				// Reload "ordered" - caches should rebuild in add-history order
				await api.slothlet.api.reload("ordered");

				// After reload: first module (API_TEST) rebuilds with replace,
				// second module (API_TEST_COLLISIONS) rebuilds with merge
				// Merged keys survive because second module merges them back
				expect(api.ordered.collections).toBeDefined();
				const powerAfter = await api.ordered.math.power(2, 3);
				expect(powerAfter).toBe(8);

				// math.add should also work (from first module)
				const mathResult = await api.ordered.math.add(5, 5);
				expect(mathResult).toBeDefined();
			});
		});

		// ─── 3. Child caches under parent path ───

		describe("Child Caches Under Parent Path", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "replace"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should rebuild all child caches when reloading parent path", async () => {
				// Add two modules as children under "parent"
				await api.slothlet.api.add("parent.child1", TEST_DIRS.API_TEST);
				await api.slothlet.api.add("parent.child2", TEST_DIRS.API_TEST_COLLISIONS);

				// Verify both children work
				// child1 (API_TEST): math.add exists
				const child1Math = await api.parent.child1.math.add(3, 4);
				expect(child1Math).toBeDefined();

				// child2 (API_TEST_COLLISIONS): properly flattened - math has all exports
				// from both math.mjs (power, sqrt, modulo, collisionVersion) and math/math.mjs (add, multiply, divide)
				const child2Power = await api.parent.child2.math.power(2, 3);
				expect(child2Power).toBe(8);
				const child2Add = await api.parent.child2.math.add(3, 4);
				expect(child2Add).toBe(7);
				expect(api.parent.child2.math.collisionVersion).toBe("math-collision-v1");

				// Reload parent - should find both child caches
				await api.slothlet.api.reload("parent");

				// Both children should still work after reload
				const child1After = await api.parent.child1.math.add(3, 4);
				expect(child1After).toBeDefined();

				const child2After = await api.parent.child2.math.power(2, 3);
				expect(child2After).toBe(8);
				expect(api.parent.child2.math.collisionVersion).toBe("math-collision-v1");
			});

			it("should preserve custom properties on parent through child reload", async () => {
				await api.slothlet.api.add("parentCustom.child1", TEST_DIRS.API_TEST);
				await api.slothlet.api.add("parentCustom.child2", TEST_DIRS.API_TEST);

				// Set custom property on parent level
				api.parentCustom.parentFlag = "preserved";

				// Set custom props on children
				api.parentCustom.child1.childFlag = "child1-data";
				api.parentCustom.child2.childFlag = "child2-data";

				// Reload parent
				await api.slothlet.api.reload("parentCustom");

				// Parent-level custom prop should survive
				expect(api.parentCustom.parentFlag).toBe("preserved");

				// Children custom props should survive (selective reload preserves them)
				expect(api.parentCustom.child1.childFlag).toBe("child1-data");
				expect(api.parentCustom.child2.childFlag).toBe("child2-data");
			});
		});

		// ─── 4. Single module at endpoint (regression) ───

		describe("Single Module Reload (Regression)", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "replace"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should still work correctly with single module at endpoint", async () => {
				await api.slothlet.api.add("single", TEST_DIRS.API_TEST);

				const resultBefore = await api.single.math.add(10, 20);
				expect(resultBefore).toBeDefined();

				api.single.testFlag = true;

				// Reload single-module endpoint (forceReplace=true, i===0)
				await api.slothlet.api.reload("single");

				// Implementation still works
				const resultAfter = await api.single.math.add(10, 20);
				expect(resultAfter).toBeDefined();

				// Custom property preserved
				expect(api.single.testFlag).toBe(true);
			});

			it("should reload base module via dot path", async () => {
				// Base module math works
				const resultBefore = await api.math.add(5, 5);
				expect(resultBefore).toBe(10);

				// Reload base module
				await api.slothlet.api.reload(".");

				// Still works after reload
				const resultAfter = await api.math.add(5, 5);
				expect(resultAfter).toBe(10);
			});

			it("should reload base module via null", async () => {
				const resultBefore = await api.math.add(1, 2);
				expect(resultBefore).toBe(3);

				// Reload base module with null
				await api.slothlet.api.reload(null);

				const resultAfter = await api.math.add(1, 2);
				expect(resultAfter).toBe(3);
			});

			it("should reload base module via empty string", async () => {
				const resultBefore = await api.math.add(1, 2);
				expect(resultBefore).toBe(3);

				// Reload base module with empty string
				await api.slothlet.api.reload("");

				const resultAfter = await api.math.add(1, 2);
				expect(resultAfter).toBe(3);
			});

			it("should reload base module via undefined", async () => {
				const resultBefore = await api.math.add(1, 2);
				expect(resultBefore).toBe(3);

				// Reload base module with undefined (no args)
				await api.slothlet.api.reload();

				const resultAfter = await api.math.add(1, 2);
				expect(resultAfter).toBe(3);
			});
		});

		// ─── 5. Collision mode respected per moduleID ───

		describe("Collision Mode Respected Per ModuleID", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "merge"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should merge keys from second module after reload", async () => {
				// First module at "collide" - has config.host, math.add, math.multiply, etc.
				await api.slothlet.api.add("collide", TEST_DIRS.API_TEST);

				// Verify API_TEST unique keys
				const hostBefore = await api.collide.config.host;
				expect(hostBefore).toBe("https://slothlet");

				// Second module at "collide" - merge mode adds new keys:
				// - collections: new top-level key
				// - math.power, math.sqrt, math.modulo: new keys merged into existing math wrapper
				// - math.collisionVersion: exists in BOTH → merge preserves API_TEST's value ("collision-math-file")
				await api.slothlet.api.add("collide", TEST_DIRS.API_TEST_COLLISIONS);

				// After merge: should have config.host, collections, AND power in math
				expect(api.collide.collections).toBeDefined();
				expect(await api.collide.config.host).toBe("https://slothlet");
				const collidePower = await api.collide.math.power(2, 3);
				expect(collidePower).toBe(8);

				// Reload path - multi-cache rebuild
				await api.slothlet.api.reload("collide");

				// First module rebuilds with replace: config.host present
				expect(await api.collide.config.host).toBe("https://slothlet");

				// Second module rebuilds with original collision mode (merge):
				// Merged keys are restored
				expect(api.collide.collections).toBeDefined();
				const powerAfter = await api.collide.math.power(2, 3);
				expect(powerAfter).toBe(8);
			});

			it("should not lose first module keys when second module merges after reload", async () => {
				// API_TEST has util/, task/, advanced/ etc. that API_TEST_COLLISIONS does not
				await api.slothlet.api.add("preserve", TEST_DIRS.API_TEST);

				// API_TEST_COLLISIONS has collections which API_TEST does not
				await api.slothlet.api.add("preserve", TEST_DIRS.API_TEST_COLLISIONS);

				// Before reload: both unique keys exist
				const hasUtil = api.preserve.util !== undefined;
				expect(hasUtil).toBe(true);
				const hasCollections = api.preserve.collections !== undefined;
				expect(hasCollections).toBe(true);

				// Reload
				await api.slothlet.api.reload("preserve");

				// After reload: first module's unique keys (util) still present
				const hasUtilAfter = api.preserve.util !== undefined;
				expect(hasUtilAfter).toBe(true);

				// Second module's unique keys (collections) still present via merge
				const hasCollectionsAfter = api.preserve.collections !== undefined;
				expect(hasCollectionsAfter).toBe(true);
			});
		});

		// ─── 6. Ownership stack through multi-cache reload ───

		describe("Ownership Stack Through Reload", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "merge"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should maintain both moduleIDs in diagnostics after reload", async () => {
				const moduleID1 = await api.slothlet.api.add("owned", TEST_DIRS.API_TEST);
				const moduleID2 = await api.slothlet.api.add("owned", TEST_DIRS.API_TEST_COLLISIONS);

				// Both caches should exist before reload
				const cachesBefore = api.slothlet.diag?.caches;
				if (cachesBefore) {
					expect(cachesBefore.has(moduleID1)).toBe(true);
					expect(cachesBefore.has(moduleID2)).toBe(true);
				}

				// Reload "owned"
				await api.slothlet.api.reload("owned");

				// Both caches should still exist after reload
				const cachesAfter = api.slothlet.diag?.caches;
				if (cachesAfter) {
					expect(cachesAfter.has(moduleID1)).toBe(true);
					expect(cachesAfter.has(moduleID2)).toBe(true);
				}
			});
		});

		// ─── 7. Custom properties through multi-cache reload ───

		describe("Custom Properties Through Multi-Cache Reload", () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					api: {
						collision: {
							initial: "replace",
							api: "merge"
						},
						mutations: {
							add: true,
							remove: true,
							reload: true
						}
					}
				});
			});

			afterEach(async () => {
				if (api) {
					await api.shutdown();
					api = null;
				}
			});

			it("should preserve custom properties through multi-cache path reload", async () => {
				await api.slothlet.api.add("customs", TEST_DIRS.API_TEST);
				await api.slothlet.api.add("customs", TEST_DIRS.API_TEST_COLLISIONS);

				// Set custom property on the endpoint wrapper
				api.customs.myCustomProp = "survive-reload";
				api.customs.customObj = { nested: true };

				// Reload
				await api.slothlet.api.reload("customs");

				// Custom properties should survive
				expect(api.customs.myCustomProp).toBe("survive-reload");
				expect(api.customs.customObj).toEqual({ nested: true });
			});
		});
	});
}
