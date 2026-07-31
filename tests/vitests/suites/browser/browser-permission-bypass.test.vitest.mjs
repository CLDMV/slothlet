/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-permission-bypass.test.vitest.mjs
 *	@Date: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Permission-bypass routes, exercised in a real browser.
 *
 * @description
 * A browser has no `node:async_hooks`, so it always runs the live context manager — the one that
 * keeps caller identity in a single ambient field instead of a per-flow store. That makes the
 * browser the weakest of the three targets, and therefore the one where these routes have to be
 * proven rather than assumed:
 *
 * - a gated call made **after an `await`**, which used to leave the ambient field empty; an absent
 *   caller reads as host-initiated and is exempt, so enforcement failed *open*
 * - the same after a **timer** turn rather than a microtask
 * - a gated call made while a **second module call is suspended concurrently**, where the ambient
 *   field names whichever module entered last and the other would inherit its rights
 *
 * Awaiting is mandatory for lazy access, so none of these is a contrived shape — they are how
 * ordinary module code is written. Node parity for the same routes lives in
 * `permissions/permissions-caller-identity-await` and
 * `permissions/permissions-caller-identity-concurrent`; this file is the browser leg.
 *
 * @module tests/vitests/suites/browser/browser-permission-bypass
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getBrowserMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

/**
 * Build a browser-mode config with `math.**` permitted to `probe.**` and denied to everyone else.
 * @param {object} matrixConfig - Matrix entry config.
 * @returns {object} Slothlet config.
 */
function denyRogue(matrixConfig) {
	return {
		...makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST),
		permissions: {
			defaultPolicy: "deny",
			rules: [
				{ caller: "probe.**", target: "math.**", effect: "allow" },
				{ caller: "**", target: "{probe,rogue}.**", effect: "allow" }
			]
		}
	};
}

describe.each(getBrowserMatrixConfigs())("Browser Mode > permission bypass routes > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an unprivileged call is denied directly, after a microtask, and after a timer", async () => {
		api = await slothlet(denyRogue(config));

		expect(await api.rogue.callDirect()).toBe("denied");
		expect(await api.rogue.callAfterAwait()).toBe("denied");
		expect(await api.rogue.callAfterTimer()).toBe("denied");
	});

	it("a privileged call still succeeds after an await — identity is kept, not merely blocked", async () => {
		api = await slothlet(denyRogue(config));

		expect(await api.probe.gatedCall(Promise.resolve())).toBe(3);
	});

	it("an unprivileged module does not inherit a concurrently-suspended caller's rights", async () => {
		api = await slothlet(denyRogue(config));

		let release;
		const gate = new Promise((resolve) => (release = resolve));

		// The unprivileged caller enters and suspends first, so the privileged one becomes the most
		// recent occupant of the ambient identity field before either resumes.
		const settled = Promise.all([api.rogue.gatedCall(gate), api.probe.gatedCall(gate)]);
		release();
		const [rogue, probe] = await settled;

		expect(rogue).toBe("denied");
		// …and the permitted caller is not collaterally denied.
		expect(probe).toBe(3);
	});
});
