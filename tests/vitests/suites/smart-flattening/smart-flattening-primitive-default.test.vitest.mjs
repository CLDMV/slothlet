/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-primitive-default.test.vitest.mjs
 *	@Date: 2026-10-10T09:36:21-07:00 (1791650181)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T09:36:21-07:00 (1791650181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A primitive default beside named exports keeps both, wherever the module sits.
 *
 * @description
 * A primitive cannot hold the named exports, so the module becomes a namespace with the primitive
 * under `default`, as a plain file already does. Fixture `api_smart_flatten_primitive_default`:
 * ```
 * level.mjs         default 3  + label = "level"  → api.level.default = 3, api.level.label = "level"
 * limit/limit.mjs   default 42 + unit = "ms"      → api.limit.default = 42, api.limit.unit = "ms"
 * quota/quota.mjs   default 7  + unit = "req"     → api.quota.default = 7, api.quota.unit = "req"
 * quota/sib.mjs     sib()                         → api.quota.sib() = "quota.sib"
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-primitive-default
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_primitive_default");

describe.each(getMatrixConfigs({}))("primitive defaults beside named exports > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a plain file keeps the primitive under default and its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.level.default).toBe(3);
		expect(await api.level.label).toBe("level");
	});

	it("a folder's only, same-named file keeps the primitive under default and its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.limit.default).toBe(42);
		expect(await api.limit.unit).toBe("ms");
	});

	it("a folder's same-named file beside a sibling keeps the primitive, its named export and the sibling", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.quota.default).toBe(7);
		expect(await api.quota.unit).toBe("req");
		expect(await api.quota.sib()).toBe("quota.sib");
	});
});
