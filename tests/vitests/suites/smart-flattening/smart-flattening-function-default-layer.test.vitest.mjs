/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-function-default-layer.test.vitest.mjs
 *	@Date: 2026-10-11T19:13:41-07:00 (1791771221)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:04:28-07:00 (1791781468)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function default with named exports is the api node, and the module's own function is
 * never written to (#585 review).
 * @description
 * `api.x()` calls the default, `api.x.extra()` is the named export, and the default's own members read
 * through; the named exports and siblings are held by the composition, not put on the module's function.
 *
 * Fixture (`api_smart_flatten_function_default_layer`):
 * ```
 * kit/tool.mjs   default main(x) → "tool:x" (main.own = 1), extra() → "tool.extra"
 * kit/spare.mjs  spare() → "kit.spare"
 * box/box.mjs    default main(x) → "box:x"  (main.own = 1), extra() → "box.extra"
 * box/side.mjs   side() → "box.side"
 * ```
 * @module tests/vitests/suites/smart-flattening/smart-flattening-function-default-layer
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_function_default_layer");

describe.each(getMatrixConfigs())("function default with named exports > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		delete globalThis.__slothletFunctionDefaultLayer;
	});

	it("calls the default and reads its named export and own member, without writing to the module's function", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.kit.tool(7)).toBe("tool:7");
		expect(await api.kit.tool.extra()).toBe("tool.extra");
		expect(await api.kit.tool.own).toBe(1);
		expect(Object.keys(globalThis.__slothletFunctionDefaultLayer.tool)).toEqual(["own"]);
	});

	it("puts a self-named file's named export and its sibling on the folder, not on the module's function", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.box(3)).toBe("box:3");
		expect(await api.box.extra()).toBe("box.extra");
		expect(await api.box.side()).toBe("box.side");
		expect(Object.keys(globalThis.__slothletFunctionDefaultLayer.box)).toEqual(["own"]);
	});
});
