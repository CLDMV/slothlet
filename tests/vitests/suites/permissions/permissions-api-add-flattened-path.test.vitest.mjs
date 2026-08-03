/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-api-add-flattened-path.test.vitest.mjs
 *	@Date: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";
import path from "node:path";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;
const MOUNT = path.join(path.dirname(BASE), "smart_flatten", "api_smart_flatten_folder_config");

/**
 * A rule targets the path the caller actually invokes — the flattened surface path — and that
 * holds however the subtree was composed.
 *
 * A subtree mounted with `api.slothlet.api.add()` used to be gated on the *canonical* module path
 * (mount + file + export) rather than the smart-flattened one, while base composition gated on the
 * flattened path. The two mechanisms were exactly inverted, so the only rule form that worked on a
 * mount named a path that does not exist on the api, and the path callers actually invoke could not
 * be permitted at all. Under `defaultPolicy: "deny"` that reads as permissions denying everything
 * for no visible reason, since the intuitive rule fails closed.
 */
describe.each(getMatrixConfigs())("Permissions > api.add flattened target path > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Mount `api_smart_flatten_folder_config` at `config`. Its `config/` subfolder repeats the
	 * mount's last segment, so smart-flattening collapses that level: the callable path is
	 * `config.getNestedConfig`, never `config.config.getNestedConfig`.
	 * @param {string} target - Rule target to allow.
	 * @returns {Promise<object>} The bound api.
	 */
	const mountWithAllow = async (target) => {
		const instance = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target, effect: "allow" }] }
		});
		await instance.slothlet.api.add("config", MOUNT);
		return instance;
	};

	it("the surface path is the flattened one", async () => {
		api = await mountWithAllow("config.getNestedConfig");
		expect(Object.keys(api.config)).toContain("getNestedConfig");
		expect(Object.keys(api.config)).not.toContain("config");
	});

	it("a rule on the callable path governs the call", async () => {
		api = await mountWithAllow("config.getNestedConfig");
		expect(await api.callers.dataReader.callMountedConfig()).toBeDefined();
	});

	it("a rule on the collapsed-away path does not — it names nothing reachable", async () => {
		api = await mountWithAllow("config.config.getNestedConfig");
		await expect(async () => await api.callers.dataReader.callMountedConfig()).rejects.toThrow(/PERMISSION_DENIED/);
	});
});
