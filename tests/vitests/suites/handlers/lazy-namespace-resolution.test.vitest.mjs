/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/lazy-namespace-resolution.test.vitest.mjs
 *	@Date: 2026-08-01 12:00:00 -07:00 (1785610800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-01 12:00:00 -07:00 (1785610800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The first await of a lazy chain resolves to the same thing every later access does.
 *
 * @description
 * Materialization adopts a module's members out of `_impl` onto the wrapper, so the waiting-proxy
 * resolver handing back `_impl` for a chain ending on an object-valued node resolved every FIRST
 * await of such a chain to a permanently-empty object — while the second access, served by the
 * getTrap against the materialized tree, was correct (#255). The contract pinned here is eager
 * parity: an awaited namespace or plain-object leaf resolves to the same live object later accesses
 * return, and terminal data (primitives and the built-ins the read gate classifies) resolves to the
 * value itself.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;
// Carries the collision shape (root logger.mjs + logger/ directory), whose slot now settles during
// build so the merged surface is complete before the api is handed out.
const DEBUG_BASE = new URL("../../../../api_tests/api_test_modes_debug", import.meta.url).pathname;

describe.each(getMatrixConfigs({ mode: "lazy" }))("Handlers > lazy namespace resolution > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("resolves a namespace chain's first await to the populated namespace", async () => {
		api = await slothlet({ ...config, base: BASE });

		// First-ever access to this subtree — nothing is materialized yet.
		const first = await api.db.secrets;
		expect(Object.keys(first)).toEqual(expect.arrayContaining(["token", "config", "label"]));

		// And it is the SAME object a later access hands back, not a one-shot snapshot.
		const second = await api.db.secrets;
		expect(second).toBe(first);
	});

	it("resolves a plain-object leaf's first await to its members", async () => {
		api = await slothlet({ ...config, base: BASE });

		const cfg = await api.db.secrets.config;
		expect(Object.keys(cfg)).toEqual(expect.arrayContaining(["publicName", "apiKey"]));
	});

	it("keeps terminal leaves resolving to their values", async () => {
		api = await slothlet({ ...config, base: BASE });

		// Primitive and built-in leaves are terminal data: the await hands back the value itself,
		// exactly as eager's getTrap returns it — not a wrapper around it.
		expect(await api.db.secrets.label).toBe("classified");
		expect(await api.db.secrets.lookup).toBeInstanceOf(Map);
	});

	it("keeps callable leaves callable", async () => {
		api = await slothlet({ ...config, base: BASE });

		const result = await api.db.read.query("select 1");
		expect(result).toEqual({ ok: true, module: "db.read", sql: "select 1" });
	});

	it("resolves deep reads through a file+directory collision slot to the leaf", async () => {
		api = await slothlet({ ...config, base: DEBUG_BASE });

		// The original symptom: a deep read below `loggerMeta` came back as the parent namespace. The
		// collision slot now settles during build (a collision cannot answer anything about itself
		// until both sides are composed), so these are plain reads over the fully merged surface —
		// pinned end-to-end so the symptom cannot return through either the walk or the composition.
		const levels = await api.logger.loggerMeta.levels;
		expect(Array.isArray(levels)).toBe(true);
		expect(levels).toEqual(["debug", "info", "warn", "error"]);
		expect(await api.logger.loggerMeta.version).toBe("1.0.0");
	});
});
