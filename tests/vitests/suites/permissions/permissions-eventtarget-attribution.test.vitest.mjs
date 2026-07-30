/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-eventtarget-attribution.test.vitest.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A DOM-style event listener runs as the module that registered it.
 *
 * @description
 * `EventTarget` is the event boundary a browser actually uses, and the one an `EventEmitter` patch
 * says nothing about. It behaves like the other deferred boundaries: the listener runs after the
 * registering call has returned, so under the live runtime it had no caller — and an absent caller is
 * read as host-initiated and exempt. A module could therefore reach a denied target from inside a
 * listener that the host itself dispatched.
 *
 * The dispatch here comes from the test, not from the module. That is deliberate: a module-initiated
 * dispatch runs the listener synchronously inside the dispatching call, where the runtime is holding
 * that module's identity anyway, so the listener would be attributed correctly for a reason that has
 * nothing to do with the registration boundary.
 *
 * The last case covers the cost of wrapping rather than the gap: the DOM identifies a listener by its
 * callback reference, so a wrapper that registered something else would break
 * `removeEventListener` for every consumer in the process.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > EventTarget attribution > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		delete globalThis.__slothletProbeTarget;
	});

	/**
	 * Arm the module's listener, dispatch to it from here, then poll the synchronous accessor.
	 * @param {object} bound - Bound `callers.dataReader` entry points.
	 * @param {number} [dispatches] - How many events to send.
	 * @returns {Promise<object|null>} The recorded outcome.
	 */
	const armDispatchAndPoll = async (bound, dispatches = 1) => {
		expect(await bound.armDomListener()).toBe("armed");
		for (let i = 0; i < dispatches; i++) {
			globalThis.__slothletProbeTarget.dispatchEvent(new Event("go"));
		}
		for (let attempt = 0; attempt < 200; attempt++) {
			const outcome = await bound.readDomOutcome();
			if (outcome) return outcome;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		return null;
	};

	it("a listener the host dispatches is still attributed to the module that registered it", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		const outcome = await armDispatchAndPoll(api.callers.dataReader);

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("a permitted module keeps its listener's access", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.dataReader.**", target: "db.secrets.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		const outcome = await armDispatchAndPoll(api.callers.dataReader);

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(true);
		expect(outcome.value).toContain("super-secret-token");
	});

	it("removeEventListener still takes the listener off by its original reference", async () => {
		api = await slothlet({ ...config, base: BASE });

		// The listener removes itself on its first run, so a second dispatch must find nothing.
		await armDispatchAndPoll(api.callers.dataReader, 2);

		expect(await api.callers.dataReader.readDomFireCount()).toBe(1);
	});
});
