/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-reader-copies.test.vitest.mjs
 *	@Date: 2026-11-25T01:23:06-08:00 (1795598586)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:13-08:00 (1795869193)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Functions a module takes out of a node's descriptors keep reading as that module reads.
 *
 * @description
 * Fixture `api_test_uwb_reader_copies`:
 * ```
 * store.mjs    data = { count: 1, nested: { deep: true } }, list = [10, 20, <get {third: 3}>, <get 40>, <get undefined>]
 * reader.mjs   inspectCopy(): calls the inspect hook described on self.store.data
 *              accessorCopies(): calls the getters described on self.store.list's accessor elements
 * ```
 * With permissions on, both are completed under the reading module's identity. What they give is what plain JS
 * gives: the getters' own values, and the data the node holds.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-reader-copies
 */

import util from "node:util";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_reader_copies", import.meta.url).pathname;

describe.each([["eager"], ["lazy"]])("descriptor copies a module takes (%s)", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["on", { permissions: { policy: "allow" } }],
		["off", {}]
	])("an accessor element's getter reads what the element's getter returns (permissions %s)", async (_label, options) => {
		api = await slothlet({ mode, base: BASE, silent: true, ...options });
		expect(await api.reader.accessorCopies()).toEqual(["function", { third: 3 }, 40, undefined]);
	});

	it("the inspect hook a module copies shows the node's data", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, permissions: { policy: "allow" } });
		expect(await api.reader.inspectCopy()).toEqual({ count: 1, nested: { deep: true } });
	});

	it("the host reads an accessor element's descriptor and its getter", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, permissions: { policy: "allow" } });
		const list = api.store.list;
		if (mode === "lazy") await list[0];
		const descriptor = Object.getOwnPropertyDescriptor(api.store.list, 3);
		expect(descriptor.get()).toBe(40);
		expect(util.inspect(api.store.data)).toContain("count");
	});
});
