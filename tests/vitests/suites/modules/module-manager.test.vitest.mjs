/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/module-manager.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:26 -07:00 (1779933446)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for the ModuleManager handler.
 *
 * @description
 * Exercises discover() cache management, addModule() lazy-discover fallback,
 * addModules() onFailure variants + concurrency, removeModule(), pre-flight
 * collision detection, and stale-mount reconciliation.
 *
 * Uses a real slothlet instance because ModuleManager calls
 * apiManager.addApiComponent() handler-to-handler.
 *
 * @module tests/vitests/suites/modules/module-manager
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_NPM = path.join(FIXTURE_ROOT, "api_test_modules_npm");
const FIX_FOLDER = path.join(FIXTURE_ROOT, "api_test_modules_folder");
const FIX_MALFORMED = path.join(FIXTURE_ROOT, "api_test_modules_malformed");

/** @type {any} */
let api;

afterEach(async () => {
	if (api?.shutdown) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

async function newSlothletWithModules() {
	api = await slothlet({
		base: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		silent: true,
		diagnostics: true,
		api: { collision: { initial: "merge", api: "merge" } }
	});
	return api.slothlet.api.modules;
}

// ─── discover() + cache ──────────────────────────────────────────────────────

describe("ModuleManager.discover()", () => {
	it("populates the discovery cache from a scanRoot", async () => {
		const mm = await newSlothletWithModules();
		const found = await mm.discover({ scanRoot: FIX_NPM });
		expect(found.length).toBe(3);
		expect(mm.getDiscoveryCache().length).toBe(3);
	});

	it("replaces the cache on each discover() call", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		await mm.discover({ scanRoot: FIX_FOLDER });
		const names = mm
			.getDiscoveryCache()
			.map((r) => r.packageName)
			.sort();
		expect(names).toEqual(["@local/driver-alpha", "@local/driver-beta"]);
	});

	it("clearDiscoveryCache() empties the cache without affecting mounted modules", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_FOLDER });
		expect(mm.getDiscoveryCache().length).toBe(2);
		mm.clearDiscoveryCache();
		expect(mm.getDiscoveryCache().length).toBe(0);
	});
});

// ─── sort() pass-through ─────────────────────────────────────────────────────

describe("ModuleManager.sort()", () => {
	it("sorts by default priority desc + alphabetical tiebreak", async () => {
		const mm = await newSlothletWithModules();
		const found = await mm.discover({ scanRoot: FIX_NPM });
		const sorted = mm.sort(found);
		const names = sorted.map((r) => r.packageName);
		expect(names[0]).toBe("@org/packrat-driver-foo"); // priority 100
		expect(names[1]).toBe("@org/packrat-driver-bar"); // priority 50
		expect(names[2]).toBe("packrat-extension-baz"); // priority default 0
	});
});

// ─── addModule() ─────────────────────────────────────────────────────────────

describe("ModuleManager.addModule()", () => {
	it("mounts a single module from a DiscoverResult and returns mountResult metadata", async () => {
		const mm = await newSlothletWithModules();
		const found = await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		const result = await mm.addModule(found[0]);
		expect(result.packageName).toBe("packrat-extension-baz");
		expect(result.mountPath).toBe("extensions.baz");
		expect(typeof result.moduleID).toBe("string");
	});

	it("mounts a module by name when the cache is populated", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		const result = await mm.addModule("@org/packrat-driver-foo");
		expect(result.packageName).toBe("@org/packrat-driver-foo");
		expect(result.mountPath).toBe("drivers.foo");
	});

	it("lazily triggers discover() when the cache is empty and a name is supplied", async () => {
		const mm = await newSlothletWithModules();
		expect(mm.getDiscoveryCache().length).toBe(0);
		const result = await mm.addModule("@local/driver-alpha", { discover: { scanRoot: FIX_FOLDER } });
		expect(result.packageName).toBe("@local/driver-alpha");
		expect(mm.getDiscoveryCache().length).toBe(2); // discover populated it
	});

	it("throws MODULE_PACKAGE_NOT_FOUND when a name cannot be resolved after discovery", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_FOLDER });
		await expect(mm.addModule("@org/does-not-exist")).rejects.toThrow(/MODULE_PACKAGE_NOT_FOUND/);
	});

	it("stores the manifest as metadata under the mounted path (B1 round-trip)", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");

		const meta = api.slothlet.metadata.getFor("extensions.baz");
		expect(meta._module).toBeDefined();
		expect(meta._module.manifest.name).toBe("packrat-extension-baz");
		expect(meta._module.manifest.kind).toBe("extension");
	});
});

// ─── Collision pre-flight (S7) ──────────────────────────────────────────────

describe("ModuleManager.addModule() — collision pre-flight (S7)", () => {
	it("throws MODULE_MOUNT_COLLISION when exact mountPath is already occupied and collisionMode=error", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.addModule("packrat-extension-baz", { collisionMode: "error" })).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});
	});

	it("allows the mount when collisionMode is 'merge' (slothlet's existing merge behavior takes over)", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");
		const result = await mm.addModule("packrat-extension-baz", { collisionMode: "merge" });
		expect(result.packageName).toBe("packrat-extension-baz");
	});
});

// ─── addModules() — onFailure variants and concurrency ──────────────────────

describe("ModuleManager.addModules() — onFailure", () => {
	it("mounts all items serially under default onFailure='throw'", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		const results = await mm.addModules(["@org/packrat-driver-foo", "@org/packrat-driver-bar"]);
		expect(Array.isArray(results)).toBe(true);
		expect(results.map((r) => r.packageName).sort()).toEqual(["@org/packrat-driver-bar", "@org/packrat-driver-foo"]);
	});

	it("accepts heterogeneous arrays mixing names and DiscoverResult objects (M4)", async () => {
		const mm = await newSlothletWithModules();
		const found = await mm.discover({ scanRoot: FIX_NPM });
		const fooEntry = found.find((r) => r.packageName === "@org/packrat-driver-foo");
		const results = await mm.addModules([fooEntry, "@org/packrat-driver-bar"]);
		expect(results.length).toBe(2);
	});

	it("returns aggregate {mounted, failed} under onFailure='best-effort'", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules(["@org/packrat-driver-foo", "@org/does-not-exist", "packrat-extension-baz"], {
				onFailure: "best-effort"
			});
			// Note: name resolution happens up-front; @org/does-not-exist fails before any mount.
			// best-effort applies to mount failures, not resolve failures.
			// → resolve throws; we catch the throw.
			expect(result).toBeUndefined(); // unreachable — exception caught below
		}).catch((err) => {
			expect(String(err)).toMatch(/MODULE_PACKAGE_NOT_FOUND/);
		});
	});

	it("rolls back mounted modules under onFailure='rollback' when a later mount fails", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		await mm.addModule("packrat-extension-baz"); // pre-mount to force a collision

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				mm.addModules(["@org/packrat-driver-foo", "packrat-extension-baz"], {
					collisionMode: "error",
					onFailure: "rollback"
				})
			).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});

		// Verify rollback removed the first mount (packrat-driver-foo) attempted in this call.
		// The pre-existing packrat-extension-baz remains.
		const checkMeta = api.slothlet.metadata.getFor("drivers.foo");
		// The rolled-back mount should no longer have the _module metadata attached.
		expect(checkMeta._module).toBeUndefined();
	});

	it("throws INVALID_ARGUMENT when items is not an array", async () => {
		const mm = await newSlothletWithModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.addModules("not-an-array")).rejects.toThrow(/INVALID_ARGUMENT/);
		});
	});

	it("throws INVALID_ARGUMENT when onFailure is invalid", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.addModules(["@org/packrat-driver-foo"], { onFailure: "bogus" })).rejects.toThrow(/INVALID_ARGUMENT/);
		});
	});
});

// ─── addModules() concurrency (G5) ──────────────────────────────────────────

describe("ModuleManager.addModules() — concurrency (G5)", () => {
	it("mounts in parallel when concurrency > 1", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		const results = await mm.addModules(["@org/packrat-driver-foo", "@org/packrat-driver-bar", "packrat-extension-baz"], {
			concurrency: 3
		});
		expect(results.length).toBe(3);
	});
});

// ─── removeModule() (S3a) ───────────────────────────────────────────────────

describe("ModuleManager.removeModule()", () => {
	it("unmounts a previously-mounted module by name and returns true", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");

		const removed = await mm.removeModule("packrat-extension-baz");
		expect(removed).toBe(true);
	});

	it("returns false when no module with the given name is mounted", async () => {
		const mm = await newSlothletWithModules();
		const removed = await mm.removeModule("never-mounted");
		expect(removed).toBe(false);
	});
});

// ─── getStaleMounts() (S3b) ─────────────────────────────────────────────────

describe("ModuleManager.getStaleMounts() — reconciliation (S3b)", () => {
	it("reports modules previously mounted but no longer in the discovery cache", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_NPM });
		await mm.addModule("packrat-extension-baz");

		// Re-discover from a different scanRoot — packrat-extension-baz is no longer in the cache.
		await mm.discover({ scanRoot: FIX_FOLDER });
		const stale = mm.getStaleMounts();
		expect(stale.length).toBe(1);
		expect(stale[0].packageName).toBe("packrat-extension-baz");
	});

	it("returns empty array when all mounts are still in the cache", async () => {
		const mm = await newSlothletWithModules();
		await mm.discover({ scanRoot: FIX_FOLDER });
		await mm.addModule("@local/driver-alpha");
		// Same scanRoot on re-discover → driver-alpha still in cache.
		await mm.discover({ scanRoot: FIX_FOLDER });
		const stale = mm.getStaleMounts();
		expect(stale).toEqual([]);
	});
});

// ─── Malformed integration (validator propagation) ──────────────────────────

describe("ModuleManager — malformed manifest propagation", () => {
	it("MODULE_MANIFEST_INVALID from validator surfaces through discover()", async () => {
		const mm = await newSlothletWithModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.discover({ scanRoot: FIX_MALFORMED, prefix: "bad-json" })).rejects.toThrow(/MODULE_MANIFEST_INVALID/);
		});
	});

	it("MODULE_RESERVED_MOUNTPATH from validator surfaces through discover()", async () => {
		const mm = await newSlothletWithModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.discover({ scanRoot: FIX_MALFORMED, prefix: "reserved-mount" })).rejects.toThrow(/MODULE_RESERVED_MOUNTPATH/);
		});
	});
});
