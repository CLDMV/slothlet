/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-array-members.test.vitest.mjs
 *	@Date: 2026-10-12T09:35:34-07:00 (1791822934)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T10:37:50-07:00 (1791826670)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An exported array keeps every member it holds and each member's descriptor, as the
 * array itself does (#585 review).
 *
 * @description
 * Fixture `api_smart_flatten_array_members`:
 * ```
 * list.mjs    default ["a", "b"] + label = "x", element 1 read-only, get first() → this[0]
 * named.mjs   tags = ["t"] + kind = "k"; other = 1
 * crate/crate.mjs   crate = ["a"] + label = "x"
 * crate/sib.mjs     sib() → "crate.sib"
 * ```
 * In plain JavaScript `list.label` is "x", `list.first` is "a", a write to `list[1]` is refused, and
 * `tags.kind` is "k". The `crate` folder is its array with `label`, and its sibling file sits beside the
 * elements as `crate.sib`.
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-array-members
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_array_members");

describe.each(getMatrixConfigs({}))("array members > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("keeps an array default's extra member, getter and read-only element", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.list;
		expect(api.list.label).toBe("x");
		expect(api.list.first).toBe("a");
		expect(Reflect.set(api.list, "1", "z")).toBe(false);
		expect(api.list[1]).toBe("b");
	});

	it("keeps a named array export's extra member", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.named;
		await api.named.tags;
		expect(api.named.tags[0]).toBe("t");
		expect(api.named.tags.kind).toBe("k");
		expect(api.named.other).toBe(1);
	});

	it("keeps a self-named array export's extra member and holds its sibling file beside the elements", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.crate;
		expect(Array.isArray(api.crate)).toBe(true);
		expect(api.crate[0]).toBe("a");
		expect(api.crate.label).toBe("x");
		expect(await api.crate.sib()).toBe("crate.sib");
		expect(Object.keys(api.crate).sort()).toEqual(["0", "label", "sib"]);
	});
});
