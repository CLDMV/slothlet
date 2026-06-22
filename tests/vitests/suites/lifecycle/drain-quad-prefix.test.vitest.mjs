/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/drain-quad-prefix.test.vitest.mjs
 *	@Date: 2026-06-18T00:00:00-00:00 (1781740800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-18 00:00:00 -00:00 (1781740800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for the `____`-prefix skip arm in `_drainInFlightLoads()` (slothlet.mjs ~line 982).
 *
 * @description
 * `_drainInFlightLoads()` walks `Object.keys(wrapper)` to collect pending
 * materialization promises before shutdown.  The walk contains:
 *
 * ```js
 * for (const key of Object.keys(wrapper)) {
 *   if (!key.startsWith("____")) collect(wrapper[key], depth + 1);
 * }
 * ```
 *
 * The FALSE branch — i.e. a key that DOES start with `____` — is skipped
 * without recursing.  This branch fires when a user module exports a
 * `____`-prefixed name.  `___adoptImplChildren` in unified-wrapper adopts such
 * a key as an own enumerable property on the wrapper (four-underscore prefix is
 * not in `internalKeys` and is not filtered by the double-underscore guard used
 * elsewhere), so `Object.keys(wrapper)` yields it during the drain walk.
 *
 * The fixture `api_tests/api_test_quad_prefix/quadleaf.mjs` exports `____weird`
 * (plain object, not a wrapper) and `normal` (function).  Both modes (eager and
 * lazy) are covered because the arm fires during `api.shutdown()` in both.
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
 * Contains a single leaf (`quadleaf.mjs`) that exports a `____weird` member.
 */
const QUAD_PREFIX_DIR = path.resolve(__dirname, "../../../../api_tests/api_test_quad_prefix");

// ─── _drainInFlightLoads: `____`-prefix skip arm (slothlet.mjs ~line 982) ────

describe.each([{ mode: "eager" }, { mode: "lazy" }])("_drainInFlightLoads — ____-prefix skip arm — $mode mode", ({ mode }) => {
	/** @type {import("@cldmv/slothlet").SlothletApi | null} */
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown().catch(() => {});
		}
		api = null;
	});

	it("shutdown() resolves cleanly when a wrapper owns a ____-prefixed child (____-prefix skip arm)", async () => {
		// Compose a slothlet instance over the quad-prefix fixture.
		// In eager mode the impl is adopted immediately; in lazy mode it is adopted on first access.
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		// Confirm ____weird is an own enumerable property on the quadleaf wrapper
		// so that Object.keys(wrapper) yields it during _drainInFlightLoads.
		const quadleafWrapper = api.quadleaf;
		expect(quadleafWrapper).toBeDefined();

		// In lazy mode the impl is adopted on first access, so force materialization BEFORE inspecting
		// keys: accessing ____weird runs ___adoptImplChildren, which makes ____weird/normal own
		// enumerable keys. Asserting Object.keys() before this access is order-dependent in lazy mode.
		// (In eager mode the impl is already adopted, so the keys are present without the access.)
		if (mode === "lazy") {
			const w = quadleafWrapper.____weird;
			expect(w).toBeDefined();
		}

		// ____weird is now an own enumerable property on the wrapper, so Object.keys(wrapper) yields it
		// during _drainInFlightLoads.
		const keys = Object.keys(quadleafWrapper);
		expect(keys).toContain("____weird");
		expect(keys).toContain("normal");

		// shutdown() → _drainInFlightLoads() → Object.keys(wrapper) yields "____weird"
		// → if (!key.startsWith("____")) is FALSE → skip arm fires (no collect call).
		// The call must resolve without throwing.
		await expect(api.shutdown()).resolves.toBeUndefined();
		api = null; // afterEach guard already calls shutdown; clear to avoid double-call.
	});

	it("____weird sub() is callable before shutdown (confirms adoption, not just key presence)", async () => {
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		const result = api.quadleaf.____weird.sub();
		expect(result).toBe(1);
	});

	it("normal export is callable and the true arm of the guard fires for it during shutdown", async () => {
		api = await slothlet({ base: QUAD_PREFIX_DIR, mode, silent: true });

		// Ensure the normal export is reachable, confirming the wrapper has both arms exercised.
		const result = await api.quadleaf.normal();
		expect(result).toBe(42);
	});
});
