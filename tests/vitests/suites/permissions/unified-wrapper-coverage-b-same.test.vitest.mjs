/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/unified-wrapper-coverage-b-same.test.vitest.mjs
 *	@Date: 2026-11-25T01:30:24-08:00 (1795599024)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:49:01-08:00 (1795600141)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `slothlet.same()` tells the same object apart from another through every layer slothlet hands out:
 * a node, a class instance, a promise a module made, and a full-isolation run's view.
 *
 * @description
 * Fixture `api_test_uwb_same`:
 * ```
 * store.mjs     data = { a: 1 }, class Box, make() -> new Box(), later() -> Promise.resolve(data)
 * checker.mjs   compare(): same() on what self.store hands it
 * ```
 * Each comparison is the plain-JS identity of what the layers stand for: `true` for one object reached two ways,
 * `false` for two objects.
 *
 * @module tests/vitests/suites/permissions/unified-wrapper-coverage-b-same
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_same", import.meta.url).pathname;

const MATRIX = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => [
		{ mode, runtime, name: "permissions on", permissions: { policy: "allow" } },
		{ mode, runtime, name: "permissions off", permissions: null }
	])
);

describe.each(MATRIX)("slothlet.same() > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("a module tells its handed values apart as plain JS identity would", async () => {
		api = await slothlet({ mode, runtime, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		expect(await api.checker.compare()).toEqual({ data: true, promise: true, instance: true, proto: true, different: false });
	});

	it("a run's own view stands for the instance's nodes", async () => {
		api = await slothlet({ mode, runtime, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		const answers = await api.slothlet.context.run.self({ user: "u" }, (view) => [
			api.slothlet.same(view.store.data, api.store.data),
			api.slothlet.same(view.store, api.store),
			api.slothlet.same(view.store.make, api.store.make),
			api.slothlet.same(view.store.data, api.store.make)
		]);
		expect(answers).toEqual([true, true, true, false]);
	});
});
