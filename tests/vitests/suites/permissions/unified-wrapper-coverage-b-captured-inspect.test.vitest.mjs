/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/unified-wrapper-coverage-b-captured-inspect.test.vitest.mjs
 *	@Date: 2026-11-25T01:48:27-08:00 (1795600107)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:48-08:00 (1795869168)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module reads of another module through `self` shows and runs as the plain values do.
 *
 * @description
 * Fixture `api_test_uwb_captured`:
 * ```
 * owner.mjs    arrow = () => 1, conf = { get g / set g, v: 2 }, class Shape { area() },
 *              agen (async generator), gen (generator), later (async),
 *              cfg with toJSON() -> { pub, run(), inner (with its own toJSON), nested: { deep: { y } } }
 * viewer.mjs   look(): typeof/call of arrow, util.inspect of each (getters and hidden members included), new Shape()
 *              mine = { a: 1 }; closeOwn(): closes its own object through `self`, then changes its prototype
 *              serialize(): JSON.stringify(self.owner.cfg)
 * ```
 * The answers are compared with the same reads of the owner's module imported as a plain module.
 *
 * @module tests/vitests/suites/permissions/unified-wrapper-coverage-b-captured-inspect
 */

import util from "node:util";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_captured", import.meta.url).pathname;

/** The same reads on the plain module. */
let plain;

/** The plain module's `cfg` serialized. */
let plainSerialized;

beforeAll(async () => {
	const owner = await import(`${BASE}/owner.mjs?plain-twin`);
	plain = {
		arrowType: typeof owner.arrow,
		arrowCall: owner.arrow(),
		arrowShown: util.inspect(owner.arrow),
		confShown: util.inspect(owner.conf, { getters: true }),
		confPlain: util.inspect(owner.conf),
		shapeShown: util.inspect(owner.Shape, { showHidden: true }),
		area: new owner.Shape().area(),
		agenShown: util.inspect(owner.agen),
		genShown: util.inspect(owner.gen),
		laterShown: util.inspect(owner.later)
	};
	plainSerialized = JSON.stringify(owner.cfg);
});

const MATRIX = ["eager", "lazy"].flatMap((mode) => [
	{ mode, name: "permissions on", permissions: { policy: "allow" } },
	{ mode, name: "permissions off", permissions: null }
]);

describe.each(MATRIX)("another module's values shown through self > $mode / $name", ({ mode, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("shows and runs them as the plain module's values", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		expect(await api.viewer.look()).toEqual(plain);
	});

	it("closes its own object through self and answers prototype changes as a closed object does", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		expect(await api.viewer.closeOwn()).toEqual({ closed: true, otherProto: false, sameProto: true, extensible: false });
	});

	it("serializes an object with its own toJSON as JSON.stringify does", async () => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		expect(await api.viewer.serialize()).toBe(plainSerialized);
	});

	it("leaves out of the serialized data a member a rule denies the reader", async () => {
		const rules = [{ caller: "viewer.**", target: "owner.cfg.nested.deep.y", effect: "deny" }];
		api = await slothlet({ mode, base: BASE, silent: true, permissions: { policy: "allow", rules } });
		expect(await api.viewer.serialize()).toBe(JSON.stringify({ pub: 1, inner: { x: 1 }, nested: { deep: {} } }));
	});
});
