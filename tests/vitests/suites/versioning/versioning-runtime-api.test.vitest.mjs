/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-runtime-api.test.vitest.mjs
 *	@Date: 2026-04-01 22:43:53 -07:00 (1775108633)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime API — test api.slothlet.versioning.list, setDefault,
 * unregister, getVersionMetadata, setVersionMetadata, and
 * metadata.setForVersion / getForVersion.
 *
 * @module tests/vitests/suites/versioning/versioning-runtime-api
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Runtime API > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("version.list returns correct structure", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true, metadata: { stable: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2", metadata: { stable: false } });

		const info = api.slothlet.versioning.list("auth");

		expect(info).toHaveProperty("versions");
		expect(info).toHaveProperty("default", "v1");
		expect(Object.keys(info.versions)).toHaveLength(2);

		const v1entry = info.versions.v1;
		expect(v1entry).toHaveProperty("versionTag", "v1");
		expect(v1entry).toHaveProperty("moduleID");
		expect(v1entry).toHaveProperty("isDefault", true);
		expect(v1entry).toHaveProperty("versionedPath", "v1.auth");
	});

	it("version.setDefault changes the default", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(api.slothlet.versioning.list("auth").default).toBe("v1");
		api.slothlet.versioning.setDefault("auth", "v2");
		expect(api.slothlet.versioning.list("auth").default).toBe("v2");
	});

	it("version.getVersionMetadata returns stored metadata", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true, tier: "ga" } });

		const meta = api.slothlet.versioning.getVersionMetadata("auth", "v1");
		expect(meta).toHaveProperty("version", "v1"); // auto-injected
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("tier", "ga");
	});

	it("version.unregister removes a version and updates list", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const result = await api.slothlet.versioning.unregister("auth", "v2");
		expect(result).toBe(true);

		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v1");
	});

	it("version.list returns undefined for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		const info = api.slothlet.versioning.list("nonexistent");
		expect(info).toBeUndefined();
	});

	it("version.setDefault throws VERSION_NOT_FOUND for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		expect(() => api.slothlet.versioning.setDefault("nonexistent", "v1")).toThrow("VERSION_NOT_FOUND");
	});

	it("version.setDefault throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.versioning.setDefault("auth", "v99")).toThrow("VERSION_NOT_FOUND");
	});

	it("version.unregister returns false for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		const result = await api.slothlet.versioning.unregister("nonexistent", "v1");
		expect(result).toBe(false);
	});

	it("version.unregister returns false for unknown version tag", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		const result = await api.slothlet.versioning.unregister("auth", "v99");
		expect(result).toBe(false);
	});

	it("version.getVersionMetadata returns undefined for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		const meta = api.slothlet.versioning.getVersionMetadata("nonexistent", "v1");
		expect(meta).toBeUndefined();
	});

	it("version.getVersionMetadata returns undefined for unknown version tag", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true } });

		const meta = api.slothlet.versioning.getVersionMetadata("auth", "v99");
		expect(meta).toBeUndefined();
	});

	it("version.setVersionMetadata merges patch into stored version metadata", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { tier: "beta" } });

		api.slothlet.versioning.setVersionMetadata("auth", "v1", { stable: true, tier: "ga" });

		const meta = api.slothlet.versioning.getVersionMetadata("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("tier", "ga"); // patched
		expect(meta).toHaveProperty("version", "v1"); // injected key always wins
		expect(meta).toHaveProperty("logicalPath", "auth"); // injected key always wins
	});

	it("version.setVersionMetadata throws VERSION_NOT_FOUND for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		expect(() => api.slothlet.versioning.setVersionMetadata("nonexistent", "v1", { stable: true })).toThrow("VERSION_NOT_FOUND");
	});

	it("version.setVersionMetadata throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.versioning.setVersionMetadata("auth", "v99", { stable: true })).toThrow("VERSION_NOT_FOUND");
	});

	it("version.setVersionMetadata with a non-object patch silently merges nothing", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true, metadata: { stable: true } });

		// Passing null as patch hits the (patch && typeof patch === "object" ? patch : {}) false branch —
		// it spreads {} instead of the non-object, so existing metadata is preserved.
		expect(() => api.slothlet.versioning.setVersionMetadata("auth", "v1", null)).not.toThrow();
		const meta = api.slothlet.versioning.getVersionMetadata("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
	});

	it("metadata.setForVersion sets regular metadata on a versioned module", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });

		api.slothlet.metadata.setForVersion("auth", "v1", "stable", true);
		api.slothlet.metadata.setForVersion("auth", "v1", { region: "us" });

		const meta = api.slothlet.metadata.getForVersion("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("region", "us");
	});

	it("metadata.getForVersion returns empty object for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		const meta = api.slothlet.metadata.getForVersion("nonexistent", "v1");
		expect(meta).toEqual({});
	});

	it("metadata.getForVersion returns empty object when no metadata set on versioned module", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		// Register a versioned module with NO metadata option — exercises the getPathMetadata
		// parent-path traversal false branch where a path segment is not in the store.
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		const meta = api.slothlet.metadata.getForVersion("auth", "v1");
		// No metadata was set, so result should be an empty object (no user keys).
		expect(meta).toEqual({});
	});

	it("metadata.setForVersion throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.metadata.setForVersion("auth", "v99", "stable", true)).toThrow("VERSION_NOT_FOUND");
	});
});
