/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/multi-version.test.vitest.mjs
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
 * @fileoverview Multi-version mounting tests (G7 case 2 + S3).
 *
 * @description
 * Verifies that addModules() routes two DiscoverResults of the same
 * packageName at different versions through slothlet's versionConfig
 * mechanism so each lands at its own versioned mount path. The highest
 * semver becomes the registered default (so the unversioned mountPath
 * dispatches to it).
 *
 * Single-version mounts continue to use plain mountPath without
 * versionConfig — verified by the existing module-manager test suite.
 *
 * @module tests/vitests/suites/modules/multi-version
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_VERSIONED = path.join(FIXTURE_ROOT, "api_test_modules_versioned");
const FIX_V1 = path.join(FIX_VERSIONED, "install-a");
const FIX_V2 = path.join(FIX_VERSIONED, "install-b");

/** @type {any} */ let api;

beforeEach(async () => {
	api = await slothlet({
		base: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		silent: true,
		diagnostics: true,
		api: { collision: { initial: "merge", api: "merge" } }
	});
});

afterEach(async () => {
	if (api?.shutdown) await api.shutdown().catch(() => {});
	api = null;
});

describe("addModules — multi-version mounting (G7 case 2)", () => {
	it("discovers two versions of the same package across separate scanRoots", async () => {
		const found = await api.slothlet.api.modules.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivEntries = found.filter((r) => r.packageName === "@org/multiv");
		expect(multivEntries.length).toBe(2);
		const versions = multivEntries.map((r) => r.manifest.version).sort();
		expect(versions).toEqual(["1.2.3", "2.0.0"]);
	});

	it("mounts both versions under versioned paths when passed together to addModules()", async () => {
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivOnly = found.filter((r) => r.packageName === "@org/multiv");
		const mounted = await mm.addModules(multivOnly);
		expect(mounted.length).toBe(2);
		const paths = mounted.map((m) => m.mountPath).sort();
		expect(paths).toEqual(["v1.drivers.multiv", "v2.drivers.multiv"]);
	});

	it("marks the highest semver as the default version (dispatcher serves it at the unversioned path)", async () => {
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivOnly = found.filter((r) => r.packageName === "@org/multiv");
		await mm.addModules(multivOnly);

		// Direct access at versioned paths should return the correct version content
		expect(api.v1.drivers.multiv.info.version()).toBe("1.2.3");
		expect(api.v2.drivers.multiv.info.version()).toBe("2.0.0");

		// The unversioned path should dispatch to v2 (highest semver)
		expect(api.drivers.multiv.info.version()).toBe("2.0.0");
	});

	it("includes versionConfig in the mount result for multi-version entries", async () => {
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivOnly = found.filter((r) => r.packageName === "@org/multiv");
		const mounted = await mm.addModules(multivOnly);

		for (const m of mounted) {
			expect(m.versionConfig).not.toBeNull();
			expect(m.versionConfig.version).toMatch(/^v\d+$/);
			expect(typeof m.versionConfig.default).toBe("boolean");
		}
		// Exactly one of the two should be default
		const defaults = mounted.filter((m) => m.versionConfig.default === true);
		expect(defaults.length).toBe(1);
		expect(defaults[0].discoverResult.manifest.version).toBe("2.0.0");
	});

	it("does NOT route through versionConfig when addModules() is called with a single item", async () => {
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1] });
		const mounted = await mm.addModules(found.filter((r) => r.packageName === "@org/multiv"));
		expect(mounted.length).toBe(1);
		expect(mounted[0].mountPath).toBe("drivers.multiv");
		expect(mounted[0].versionConfig).toBeNull();
	});

	it("emits modules:mount-complete events for each version with version-aware mountPath", async () => {
		const events = [];
		api.slothlet.lifecycle.on("modules:mount-complete", (p) => events.push(p));

		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivOnly = found.filter((r) => r.packageName === "@org/multiv");
		await mm.addModules(multivOnly);

		expect(events.length).toBe(2);
		const eventVersions = events.map((e) => e.version).sort();
		expect(eventVersions).toEqual(["1.2.3", "2.0.0"]);
		const eventPaths = events.map((e) => e.mountPath).sort();
		expect(eventPaths).toEqual(["v1.drivers.multiv", "v2.drivers.multiv"]);
	});
});

describe("addModules — multi-version + S7 pre-flight collision", () => {
	it("checks the EFFECTIVE versioned path for collisions (not the plain mountPath)", async () => {
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ scanRoot: [FIX_V1, FIX_V2] });
		const multivOnly = found.filter((r) => r.packageName === "@org/multiv");
		// First mount both versions
		await mm.addModules(multivOnly);
		// Re-mounting v1 alone (single-item, no versionConfig) attempts to mount at plain "drivers.multiv".
		// The dispatcher proxy at drivers.multiv exists from the multi-version mount — collisionMode "merge"
		// is the default, so it merges. With explicit "error" it should throw at exact-mountPath check.
		await expect(
			mm.addModule(
				multivOnly.find((r) => r.manifest.version === "1.2.3"),
				{ collisionMode: "error" }
			)
		).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
	});
});
