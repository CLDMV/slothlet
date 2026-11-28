/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-options-arms.test.vitest.mjs
 *	@Date: 2026-11-25T02:16:16-08:00 (1795601776)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:39-08:00 (1795869099)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.reload()` options: null is the same as none, and an `instance` that is no string is
 * refused by its type.
 *
 * @module tests/vitests/suites/core/reload-options-arms.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;
afterEach(async () => {
	await api?.shutdown();
	api = null;
});

describe("reload() options", () => {
	it("takes null as no options: a new instance ID", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });
		const before = api.slothlet.instance.id;
		const sum = await api.math.add(2, 3);
		await api.slothlet.reload(null);
		expect(await api.math.add(2, 3)).toBe(sum);
		expect(api.slothlet.instance.id).not.toBe(before);
	});

	it("refuses an instance option that is no string, naming its type", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });
		await expect(api.slothlet.reload({ instance: 5 })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});
});
