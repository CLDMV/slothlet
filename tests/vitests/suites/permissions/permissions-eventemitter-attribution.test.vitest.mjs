/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-eventemitter-attribution.test.vitest.mjs
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
 * @fileoverview An EventEmitter listener runs as the module that registered it, not as the host.
 *
 * @description
 * A listener fires long after the call that registered it has finished, so whatever identity it
 * carries has to have been captured at registration. Slothlet wraps listeners registered inside an
 * api context for exactly that reason — but it captures with `AsyncResource.runInAsyncScope()`,
 * which restores an **AsyncLocalStorage** context. That serves the async runtime only: the live
 * manager never reads ALS, and a browser has no `AsyncResource` at all, since `async_hooks` is
 * absent there.
 *
 * So under live — and therefore in every browser — a module's listener had no captured identity. It
 * ran with none at all, which enforcement reads as host-initiated and exempt: a listener registered
 * by a module got *more* authority than the module itself, and rules that denied the module did not
 * apply to the callbacks it scheduled.
 *
 * The fixture deliberately lets the registering call settle before the event fires. While that call
 * is still in flight the runtime is holding its identity anyway, so the listener would be attributed
 * correctly for an unrelated reason — a test arranged that way passes without any fix and proves
 * nothing.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > EventEmitter attribution > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Arm the listener, wait for the registering call to settle and the event to fire.
	 * @param {object} instance - Bound api.
	 * @returns {Promise<object>} The listener's recorded outcome.
	 */
	const armAndWait = async (instance) => {
		expect(await instance.callers.dataReader.armEventListener()).toBe("armed");
		// Polled from the test, never by awaiting a second call into the module: that would hold a
		// call open across the event and the listener would inherit its identity, passing regardless
		// of whether registration captured anything. Bounded generously so parallel suite load cannot
		// turn a slow machine into a failure.
		for (let attempt = 0; attempt < 200; attempt++) {
			const outcome = await instance.callers.dataReader.readEventOutcome();
			if (outcome) return outcome;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		return null;
	};

	it("a listener registered by a denied module is refused, not exempted", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		const outcome = await armAndWait(api);

		expect(outcome).not.toBeNull();
		// Reaching the value would mean the listener ran with authority its module does not have.
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("a listener registered by a permitted module still works", async () => {
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

		const outcome = await armAndWait(api);

		// The correction must not cost a legitimate listener its access — it is about attributing the
		// listener, not about refusing listeners.
		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(true);
		expect(outcome.value).toContain("super-secret-token");
	});
});
