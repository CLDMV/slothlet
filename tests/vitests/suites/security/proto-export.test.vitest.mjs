/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/security/proto-export.test.vitest.mjs
 *	@Date: 2026-10-12T15:24:17-07:00 (1791843857)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T15:34:09-07:00 (1791844449)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module export named `__proto__` is refused at load (#585 review).
 *
 * @description
 * Fixture `api_test_proto_export`:
 * ```
 * mod.mjs   export { tag as __proto__ } (tag = { role: "x" }), fine = "fine"
 * ```
 * Composing the export would set the node's prototype rather than add a member, and no api path can
 * hold `__proto__` (an `api.add` mount path, a `self` write and a routine name all refuse it). Loading
 * the module refuses it with the same unsafe-segment error, in every mode, before anything composes.
 *
 * @module tests/vitests/suites/security/proto-export
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_proto_export", import.meta.url).pathname;

describe.each(getMatrixConfigs({}))("__proto__ export > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("refuses the module with the unsafe-segment error", async () => {
		await expect(async () => {
			api = await slothlet({ ...config, base: BASE, silent: true });
			// Lazy loads the file at first touch; eager refuses at boot.
			await api.mod?.fine;
		}).rejects.toMatchObject({ code: "INVALID_CONFIG_API_PATH_INVALID" });
		expect(Object.prototype.role).toBeUndefined();
	});
});
