/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-instance-default.test.vitest.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T21:28:45-07:00 (1791520125)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class-instance default composes as a namespace whose prototype methods and getters
 * see the instance's own state, in eager and lazy mode, on every path that builds a module's content,
 * and getters stay live, as the same object behaves in plain JavaScript (#587 review, #589, #590).
 *
 * @description
 * Fixture `api_tests/smart_flatten/api_smart_flatten_instance_default`: every module's default is a
 * `Store` instance (`items` own state, `count()` on the prototype, `size` a getter) and, except
 * `tools/bare.mjs`, a named `label()` merged onto it.
 * - `addapi/addapi.mjs`: an addapi file whose default is its folder's namespace (Rule 11 with Rule 8).
 * - `store/addapi.mjs`: an addapi file in a namespace folder, and the same folder mounted with `api.add`;
 *   its default is merged into the folder member by member (Rule 11), prototype members included (#590).
 * - `tools/counter.mjs`, `tools/bare.mjs`: files in a namespace folder.
 * - `tools/bag.mjs`: a plain-object default whose getter reads module state (#590).
 * - `solo/solo.mjs`: a file named after its folder (Rule 8).
 * - `counter.mjs`: a root file.
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-instance-default
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_instance_default");

/**
 * Read an api node by dotted path.
 * @param {object} api - Slothlet api.
 * @param {string} apiPath - Dotted path.
 * @returns {unknown} The node.
 */
const at = (api, apiPath) => apiPath.split(".").reduce((node, key) => node[key], api);

describe.each(getMatrixConfigs({}))("class-instance default > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(["addapi", "store", "mounted", "tools.counter", "solo", "counter"])(
		"%s keeps the instance's prototype methods and live getters next to its named export",
		async (apiPath) => {
			api = await slothlet({ ...config, base: BASE });
			await api.slothlet.api.add("mounted", `${BASE}/store`);
			expect(await at(api, apiPath).label()).toBe("named-label");
			// Re-read after the first call: a lazy reference taken before its folder loaded is a stand-in.
			const node = at(api, apiPath);
			const count = await node.count();
			expect(await node.size).toBe(count);
			expect(await node.add("z")).toBe(count + 1);
			expect(await node.count()).toBe(count + 1);
			expect(await node.size).toBe(count + 1);
		}
	);

	it("a class-instance default without named exports keeps its prototype methods and live getters (#589)", async () => {
		api = await slothlet({ ...config, base: BASE });
		const count = await api.tools.bare.count();
		expect(await api.tools.bare.size).toBe(count);
		expect(await api.tools.bare.add("z")).toBe(count + 1);
		expect(await api.tools.bare.size).toBe(count + 1);
	});

	it("a plain-object default's getter stays live (#590)", async () => {
		api = await slothlet({ ...config, base: BASE });
		const size = await api.tools.bag.size;
		expect(await api.tools.bag.add("z")).toBe(size + 1);
		expect(await api.tools.bag.size).toBe(size + 1);
	});

	it("copies a default without changing its shape", async () => {
		api = await slothlet({ ...config, base: BASE });
		const flatten = resolveWrapper(api.tools).slothlet.processors.flatten;
		const list = ["a", "b"];
		list.extra = "x";
		const listCopy = flatten.cloneDefault(list);
		expect(Array.isArray(listCopy)).toBe(true);
		expect([...listCopy]).toEqual(["a", "b"]);
		expect(listCopy.extra).toBe("x");
		expect(listCopy).not.toBe(list);

		class Box {
			constructor() {
				this.value = 3;
			}
			get doubled() {
				return this.value * 2;
			}
		}
		const box = new Box();
		const boxCopy = flatten.cloneDefault(box);
		expect(boxCopy).toBeInstanceOf(Box);
		expect(boxCopy.doubled).toBe(6);
		expect(boxCopy).not.toBe(box);
	});
});
