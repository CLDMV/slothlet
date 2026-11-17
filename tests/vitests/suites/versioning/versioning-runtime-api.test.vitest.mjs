/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-runtime-api.test.vitest.mjs
 *	@Date: 2026-04-01T22:43:53-07:00 (1775108633)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:27-07:00 (1791090927)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Runtime API > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("version.list returns correct structure", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

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

	it("versioning.default changes the default", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(api.slothlet.versioning.list("auth").default).toBe("v1");
		api.slothlet.versioning.default("auth", "v2");
		expect(api.slothlet.versioning.list("auth").default).toBe("v2");
	});

	it("versioning.metadata.get returns stored metadata", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true, tier: "ga" } });

		const meta = api.slothlet.versioning.metadata.get("auth", "v1");
		expect(meta).toHaveProperty("version", "v1"); // auto-injected
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("tier", "ga");
	});

	it("versioning.remove removes a version and updates list", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const result = await api.slothlet.versioning.remove("auth", "v2");
		expect(result).toBe(true);

		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v1");
	});

	it("version.list returns undefined for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		const info = api.slothlet.versioning.list("nonexistent");
		expect(info).toBeUndefined();
	});

	it("versioning.default throws VERSION_NOT_FOUND for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		expect(() => api.slothlet.versioning.default("nonexistent", "v1")).toThrow("VERSION_NOT_FOUND");
	});

	it("versioning.default throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.versioning.default("auth", "v99")).toThrow("VERSION_NOT_FOUND");
	});

	it("versioning.remove returns false for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		const result = await api.slothlet.versioning.remove("nonexistent", "v1");
		expect(result).toBe(false);
	});

	it("versioning.remove returns false for unknown version tag", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		const result = await api.slothlet.versioning.remove("auth", "v99");
		expect(result).toBe(false);
	});

	it("versioning.metadata.get returns undefined for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		const meta = api.slothlet.versioning.metadata.get("nonexistent", "v1");
		expect(meta).toBeUndefined();
	});

	it("versioning.metadata.get returns undefined for unknown version tag", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true } });

		const meta = api.slothlet.versioning.metadata.get("auth", "v99");
		expect(meta).toBeUndefined();
	});

	it("versioning.metadata.set merges patch into stored version metadata", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { tier: "beta" } });

		api.slothlet.versioning.metadata.set("auth", "v1", { stable: true, tier: "ga" });

		const meta = api.slothlet.versioning.metadata.get("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("tier", "ga"); // patched
		expect(meta).toHaveProperty("version", "v1"); // injected key always wins
		expect(meta).toHaveProperty("logicalPath", "auth"); // injected key always wins
	});

	it("versioning.metadata.set throws VERSION_NOT_FOUND for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		expect(() => api.slothlet.versioning.metadata.set("nonexistent", "v1", { stable: true })).toThrow("VERSION_NOT_FOUND");
	});

	it("versioning.metadata.set throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.versioning.metadata.set("auth", "v99", { stable: true })).toThrow("VERSION_NOT_FOUND");
	});

	it("versioning.metadata.set with a non-object patch silently merges nothing", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true, metadata: { stable: true } });

		// Passing null as patch hits the (patch && typeof patch === "object" ? patch : {}) false branch —
		// it spreads {} instead of the non-object, so existing metadata is preserved.
		expect(() => api.slothlet.versioning.metadata.set("auth", "v1", null)).not.toThrow();
		const meta = api.slothlet.versioning.metadata.get("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
	});

	it("metadata.setForVersion sets regular metadata on a versioned module", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });

		api.slothlet.metadata.setForVersion("auth", "v1", "stable", true);
		api.slothlet.metadata.setForVersion("auth", "v1", { region: "us" });

		const meta = api.slothlet.metadata.getForVersion("auth", "v1");
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("region", "us");
	});

	it("metadata.getForVersion returns empty object for unknown path", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		const meta = api.slothlet.metadata.getForVersion("nonexistent", "v1");
		expect(meta).toEqual({});
	});

	it("metadata.getForVersion returns empty object when no metadata set on versioned module", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		// Register a versioned module with NO metadata option — exercises the getPathMetadata
		// parent-path traversal false branch where a path segment is not in the store.
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		const meta = api.slothlet.metadata.getForVersion("auth", "v1");
		// No metadata was set, so result should be an empty object (no user keys).
		expect(meta).toEqual({});
	});

	it("metadata.setForVersion throws VERSION_NOT_FOUND for unknown version tag", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		expect(() => api.slothlet.metadata.setForVersion("auth", "v99", "stable", true)).toThrow("VERSION_NOT_FOUND");
	});

	it("versionManager.getVersionMetadata returns stored metadata by moduleID directly", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true } });

		const info = api.slothlet.versioning.list("auth");
		const { moduleID } = info.versions.v1;

		// Access the internal handler directly to exercise getVersionMetadata(moduleID)
		const sl = resolveWrapper(api.v1.auth).slothlet;
		const meta = sl.handlers.versionManager.getVersionMetadata(moduleID);

		expect(meta).toHaveProperty("version", "v1");
		expect(meta).toHaveProperty("stable", true);
	});
});
