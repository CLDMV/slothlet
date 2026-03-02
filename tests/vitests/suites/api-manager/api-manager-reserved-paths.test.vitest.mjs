/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reserved-paths.test.vitest.mjs
 *	@Date: 2026-02-27T22:17:01-08:00 (1772259421)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:44 -08:00 (1772425304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for normalizeApiPath reserved-name guard (api-manager.mjs line 186)
 * and misc addApiComponent validation paths (lines 1082, 1095).
 *
 * @description
 * Exercises:
 *   line 186 – INVALID_CONFIG_API_PATH_INVALID for reserved names: "slothlet", "shutdown", "destroy",
 *              and composite paths whose first segment is "slothlet" (e.g. "slothlet.hook")
 *
 * @module tests/vitests/suites/api-manager/api-manager-reserved-paths
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CONFIGS = [
	{ name: "eager/hooks-on", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "lazy/hooks-on", config: { mode: "lazy", runtime: "async", hook: { enabled: true } } }
];

/**
 * Create a loaded slothlet instance.
 * @param {object} base - Config to use.
 * @returns {Promise<object>} API proxy.
 */
async function makeApi(base) {
	return slothlet({ ...base, dir: TEST_DIRS.API_TEST });
}

describe.each(CONFIGS)("normalizeApiPath reserved names — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID when apiPath top-level segment is 'slothlet'", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("slothlet", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID when apiPath first segment is 'slothlet' (composite path)", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("slothlet.sub", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID when apiPath is 'shutdown'", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("shutdown", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID when apiPath is 'destroy'", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("destroy", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});

	it("accepts a normal non-reserved apiPath without throwing", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("plugins", TEST_DIRS.API_TEST)
		).resolves.toBeDefined();
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID for paths with invalid characters (starts with dot)", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add(".hidden", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});

	it("accepts empty string path as root-level add (normalizes to root)", async () => {
		// Empty string "" maps to root – it's valid and does NOT throw.
		// This exercises the `normalized === ""` early-return path in normalizeApiPath.
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("", TEST_DIRS.API_TEST)
		).resolves.toBeDefined();
	});

	it("throws INVALID_CONFIG_API_PATH_INVALID for paths with consecutive dots", async () => {
		api = await makeApi(config);
		await expect(
			api.slothlet.api.add("a..b", TEST_DIRS.API_TEST)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
	});
});
