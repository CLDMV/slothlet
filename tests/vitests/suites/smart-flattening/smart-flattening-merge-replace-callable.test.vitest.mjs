/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-merge-replace-callable.test.vitest.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A root file and a same-named folder that both export a default function resolve the
 * callable slot by collision mode (#584).
 *
 * @description
 * The folder `services/` composes first; the root file `services.mjs` (a root contributor) is applied
 * after it, so it is the incoming side. O02 / O09: `merge` keeps the first function and members,
 * `merge-replace` takes the incoming function and members while keeping the folder's other members,
 * `replace` takes the incoming module whole, `skip` keeps the existing one whole.
 *
 * Fixture (`api_smart_flatten_merge_replace_callable`):
 * ```
 * services.mjs           default services() → "root-services", shared() → "root-shared", getVersion()
 * utils.mjs              default utils()
 * services/services.mjs  default services() → "inner-services", shared() → "inner-shared", type = "inner-type"
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-merge-replace-callable
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_merge_replace_callable");

/** @type {Record<string, {call: string, shared: string, keys: string[]}>} */
const EXPECTED = {
	merge: { call: "inner-services", shared: "inner-shared", keys: ["getVersion", "shared", "type"] },
	"merge-replace": { call: "root-services", shared: "root-shared", keys: ["getVersion", "shared", "type"] },
	replace: { call: "root-services", shared: "root-shared", keys: ["getVersion", "shared"] },
	skip: { call: "inner-services", shared: "inner-shared", keys: ["shared", "type"] }
};

describe.each(getMatrixConfigs())("root file vs same-named folder callable collision (#584) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(Object.entries(EXPECTED))("collision.initial %s", async (initial, { call, shared, keys }) => {
		api = await slothlet({ ...config, base: BASE, collision: { initial } });
		await api.services;
		expect(await api.services()).toBe(call);
		expect(await api.services.shared()).toBe(shared);
		expect(Object.keys(api.services).sort()).toEqual(keys);
	});
});

/**
 * A root callable file and a same-named folder with NO function of its own (#586): the callable takes
 * the slot in every mode but `skip` (O09), with the folder's members merged on. Lazy used to lose the
 * function under `merge`, because the folder kept the slot before it was known to be a plain namespace.
 * @type {Record<string, {call: string|null, keys: string[]}>}
 */
const PLAIN_FOLDER_EXPECTED = {
	merge: { call: "root-services", keys: ["extra", "other", "shared"] },
	"merge-replace": { call: "root-services", keys: ["extra", "other", "shared"] },
	replace: { call: "root-services", keys: ["extra", "shared"] },
	skip: { call: null, keys: ["other"] }
};

describe.each(getMatrixConfigs())("root callable file vs same-named plain folder (#586) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(Object.entries(PLAIN_FOLDER_EXPECTED))("collision.initial %s", async (initial, { call, keys }) => {
		api = await slothlet({
			...config,
			base: path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_callable_file_plain_folder"),
			collision: { initial }
		});
		await api.services;
		if (call === null) {
			await expect(async () => api.services()).rejects.toThrow();
		} else {
			expect(await api.services()).toBe(call);
		}
		expect(Object.keys(api.services).sort()).toEqual(keys);
	});
});
