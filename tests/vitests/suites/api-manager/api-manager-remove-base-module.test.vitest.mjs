/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-base-module.test.vitest.mjs
 *	@Date: 2026-06-21T00:00:00-00:00 (1782000000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 00:00:00 -00:00 (1782000000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression: removing a base/core module by its moduleID must not crash on the
 * OwnershipManager's "." endpoint. The moduleID-removal path in removeApiComponent fed the recorded
 * mount endpoint straight into normalizeApiPath(); for a base module that endpoint is ".", which
 * splits to empty segments and threw INVALID_CONFIG_API_PATH_INVALID. "." must be treated as the
 * root so the longest-common-prefix fallback derives the real mount root instead of crashing.
 *
 * @module tests/vitests/suites/api-manager/api-manager-remove-base-module
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Resolve the internal Slothlet instance from the API proxy.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [prop="math"] - A property that has a wrapper.
 * @returns {import("@cldmv/slothlet").Slothlet} Internal Slothlet instance.
 */
function getSlInstance(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

describe('api-manager — remove a base module by moduleID ("." endpoint)', () => {
	let api;
	afterEach(async () => {
		try {
			if (api?.shutdown) await api.shutdown();
		} catch {
			/* base-module removal can leave the api partial; ignore shutdown errors in teardown */
		}
		api = null;
	});

	it('does not crash on the base module\'s "." endpoint (no INVALID_CONFIG_API_PATH_INVALID)', async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", diagnostics: true, silent: true });
		const sl = getSlInstance(api);

		// OwnershipManager records the boot-time base module with endpoint "." (slothlet.mjs).
		const baseModuleId = [...sl.handlers.ownership.moduleEndpoints].find(([, endpoint]) => endpoint === ".")?.[0];
		expect(baseModuleId, 'a base module registered with the "." endpoint should exist').toBeTruthy();

		// Before the fix, removeApiComponent fed "." straight into normalizeApiPath(), which splits to
		// empty segments and rejected with INVALID_CONFIG_API_PATH_INVALID.
		let caught = null;
		try {
			await api.slothlet.api.remove(baseModuleId);
		} catch (err) {
			caught = err;
		}
		expect(caught, caught && `unexpected throw: ${caught.code ?? ""} ${caught.message ?? caught}`).toBeNull();
	});
});
