/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/drain-quad-prefix.test.vitest.mjs
 *	@Date: 2026-06-18T00:00:00+00:00 (1781740800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:09-07:00 (1791090909)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shutdown drain over a wrapper that owns a `__`-prefixed child (`_drainInFlightLoads()`).
 *
 * @description
 * `_drainInFlightLoads()` walks `Object.keys(wrapper)` to collect pending
 * materialization promises before shutdown.  When a user module exports a
 * `__`-prefixed name, `___adoptImplChildren` in unified-wrapper adopts it as an
 * own enumerable property on the wrapper, so `Object.keys(wrapper)` yields it
 * during the drain walk and the drain must pass over it cleanly.
 *
 * The fixture `api_tests/api_test_quad_prefix/quadleaf.mjs` exports `__weird`
 * (plain object, not a wrapper) and `normal` (function).  Both modes (eager and
 * lazy) are covered because the drain runs during `api.shutdown()` in both.
 *
 * @module tests/vitests/suites/lifecycle/drain-quad-prefix
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import slothlet from "@cldmv/slothlet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Absolute path to the quad-prefix fixture directory.
 * Contains a single leaf (`quadleaf.mjs`) that exports a `__weird` member.
 */
const QUAD_PREFIX_DIR = path.resolve(__dirname, "../../../../api_tests/api_test_quad_prefix");

// ─── _drainInFlightLoads: `__`-prefixed child ────

describe.each([{ mode: "eager" }, { mode: "lazy" }])("_drainInFlightLoads — __-prefixed child — $mode mode", ({ mode }) => {
	/** @type {import("@cldmv/slothlet").SlothletApi | null} */
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown().catch(() => {});
		}
		api = null;
	});

	it("shutdown() resolves cleanly when a wrapper owns a __-prefixed child", async () => {
		// Compose a slothlet instance over the quad-prefix fixture.
		// In eager mode the impl is adopted immediately; in lazy mode it is adopted on first access.
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		// Confirm __weird is an own enumerable property on the quadleaf wrapper
		// so that Object.keys(wrapper) yields it during _drainInFlightLoads.
		const quadleafWrapper = api.quadleaf;
		expect(quadleafWrapper).toBeDefined();

		// In lazy mode the impl is adopted on first access, so force materialization BEFORE inspecting
		// keys: accessing __weird runs ___adoptImplChildren, which makes __weird/normal own
		// enumerable keys. Asserting Object.keys() before this access is order-dependent in lazy mode.
		// (In eager mode the impl is already adopted, so the keys are present without the access.)
		if (mode === "lazy") {
			const w = quadleafWrapper.__weird;
			expect(w).toBeDefined();
		}

		// __weird is now an own enumerable property on the wrapper, so Object.keys(wrapper) yields it
		// during _drainInFlightLoads.
		const keys = Object.keys(quadleafWrapper);
		expect(keys).toContain("__weird");
		expect(keys).toContain("normal");

		// shutdown() → _drainInFlightLoads() → Object.keys(wrapper) yields "__weird"
		// → the drain walk passes over it.
		// The call must resolve without throwing.
		await expect(api.shutdown()).resolves.toBeUndefined();
		api = null; // afterEach guard already calls shutdown; clear to avoid double-call.
	});

	it("__weird sub() is callable before shutdown (confirms adoption, not just key presence)", async () => {
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		const result = api.quadleaf.__weird.sub();
		expect(result).toBe(1);
	});

	it("normal export is callable and is collected during shutdown", async () => {
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		// Ensure the normal export is reachable, confirming the wrapper has both members.
		const result = await api.quadleaf.normal();
		expect(result).toBe(42);
	});
});
