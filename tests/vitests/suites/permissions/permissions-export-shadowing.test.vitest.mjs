/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-export-shadowing.test.vitest.mjs
 *	@Date: 2026-09-27 08:20:50 -07:00 (1790522450)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:30 -07:00 (1791083070)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #475 — a module export whose name collides with a property the wrapper answers
 * itself (`name`, `length`, …) must resolve to the export and be read-gated like any other export.
 * The wrapper's get trap used to answer those keys (`name` from the api path, `length` from the
 * impl's arity) before looking at the module's exports, so the export was unreachable and the read
 * never reached permission enforcement.
 *
 * The export wins once the module is loaded (always, in eager mode). An unloaded lazy module has no
 * members yet, so until it loads the wrapper keeps answering — finding out would mean loading it.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Read `self.owner[key]` from inside the reader module, settling lazy waiting proxies.
 * @param {object} api - Bound api.
 * @param {string} key - Owner export to read.
 * @returns {Promise<unknown>} The value.
 */
const readFromModule = async (api, key) => await api.reader.read(key);

describe.each(getMatrixConfigs())("Permissions > exports shadowed by wrapper-owned properties (#475) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an export named `name` / `length` resolves to the export", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EXPORT_SHADOW });
		// Load the module first so this asserts the materialized surface.
		expect(await readFromModule(api, "label")).toBe("owner-label");

		expect(await readFromModule(api, "name")).toBe("owner-name");
		expect(await readFromModule(api, "length")).toBe(42);
		expect(api.owner.name).toBe("owner-name");
		expect(api.owner.length).toBe(42);
	});

	it("reading such an export from another module is permission-gated", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EXPORT_SHADOW, permissions: { defaultPolicy: "deny", rules: [] } });
		await expect(readFromModule(api, "label")).rejects.toThrow(/PERMISSION_DENIED/);

		await expect(readFromModule(api, "name")).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(readFromModule(api, "length")).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("a module with no such export still resolves name / length to the wrapper's own, before and after loading", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EXPORT_SHADOW });
		expect(await api.reader.name).toBe("reader");
		expect(await api.reader.length).toBe(0);
		expect(api.reader.name).toBe("reader");
	});

	it("string coercion and serialization of a module are unaffected", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EXPORT_SHADOW });
		expect(() => String(api.reader)).not.toThrow();
		expect(() => JSON.stringify(api.reader)).not.toThrow();
		expect(api.reader.constructor).toBe(Object);
	});

	it("a module with no such export still reports the wrapper's own name and length", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EXPORT_SHADOW });
		await readFromModule(api, "label");
		expect(api.reader.name).toBe("reader");
		expect(typeof api.reader.read.length).toBe("number");
	});
});
