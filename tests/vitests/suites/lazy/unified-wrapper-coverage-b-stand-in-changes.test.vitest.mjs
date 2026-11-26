/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/unified-wrapper-coverage-b-stand-in-changes.test.vitest.mjs
 *	@Date: 2026-11-25T02:02:03-08:00 (1795600923)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:02:03-08:00 (1795600923)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes made through stand-ins a lazy node handed out before it loaded land as the same changes on the
 * plain objects would.
 *
 * @description
 * Fixture `api_test_uwb_shapes` (`obj.mjs`: `data`, `conf`). A stand-in for `api.obj.data` closed after the node loaded
 * closes the object; members set through two stand-ins read back from each; a definition and a prototype change made
 * through a stand-in inside a full-isolation run stay in that run (docs/CONTEXT-PROPAGATION.md, "Full Isolation").
 *
 * @module tests/vitests/suites/lazy/unified-wrapper-coverage-b-stand-in-changes
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_shapes", import.meta.url).pathname;

describe("changes through lazy stand-ins", () => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("a stand-in closed after the node loaded closes the object", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, silent: true });
		const standIn = api.obj.data;
		await api.obj;
		expect(Reflect.preventExtensions(standIn)).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(Object.isExtensible(api.obj.data)).toBe(false);
	});

	it("members set through two stand-ins read back from each, before and after the load", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, silent: true });
		const data = api.obj.data;
		const conf = api.obj.conf;
		data.k = 1;
		conf.k = 2;
		expect(conf.k).toBe(2);
		expect(data.k).toBe(1);
		await api.obj;
		expect(api.obj.conf.k).toBe(2);
		expect(api.obj.data.k).toBe(1);
	});

	it("a definition and a prototype change through a stand-in in a full-isolation run stay in the run", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, silent: true });
		const inRun = await api.slothlet.context.run.self({ user: "u" }, async (view) => {
			const standIn = view.obj.data;
			const defined = Reflect.defineProperty(standIn, "z", { value: 9, writable: true, enumerable: true, configurable: true });
			const reprototyped = Reflect.setPrototypeOf(standIn, null);
			await view.obj;
			return [defined, reprototyped, view.obj.data.z, Object.getPrototypeOf(view.obj.data)];
		});
		expect(inRun).toEqual([true, true, 9, null]);
		expect(api.obj.data.z).toBeUndefined();
		expect(Object.getPrototypeOf(api.obj.data)).toBe(Object.prototype);
	});
});
