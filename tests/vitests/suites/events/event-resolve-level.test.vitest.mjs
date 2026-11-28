/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/events/event-resolve-level.test.vitest.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:45-08:00 (1795869105)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.event.level(subscriberPath, event)` — the host-only query a
 * trusted boundary layer (e.g. `@cldmv/slothlet-vine`) uses to resolve a SUPPLIED subscriber
 * identity's delivery level on the serving side, without subscribing, so it can strip the payload
 * before it crosses a boundary.
 *
 * @description
 * Exercises: correct resolution against the rule set (allow / deny / notify default), the host
 * (`null`) short-circuit, that it registers nothing, that it agrees with a real subscription's
 * granted level, argument validation, and — critically — that it is HOST-ONLY (a module caller is
 * refused rather than answered) across the full eager/lazy × async/live matrix.
 *
 * @module tests/vitests/suites/events/event-resolve-level.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

describe.each(getMatrixConfigs())("Events > resolveLevel (host-side level query) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the events api with a baseline event-rule set (allow reporting, deny blocked), plus any extra rules.
	 * @param {Array<object>} [extra=[]] - Additional event rules.
	 * @returns {object} slothlet config.
	 */
	const withRules = (extra = []) => ({
		...config,
		base: BASE,
		permissions: {
			policy: "allow",
			events: {
				policy: "notify",
				rules: [
					{ caller: "reporting.**", event: "orders.*", effect: "allow" },
					{ caller: "blocked.**", event: "orders.*", effect: "deny" },
					...extra
				]
			}
		}
	});

	it("resolves a supplied identity to the level it would be granted, without subscribing", async () => {
		api = await slothlet(withRules());
		const ev = api.slothlet.event;
		expect(ev.level("reporting.dash", "orders.created")).toBe("allow"); // matched allow
		expect(ev.level("blocked.x", "orders.created")).toBe("deny"); // matched deny
		expect(ev.level("other.mod", "orders.created")).toBe("notify"); // no rule → default
		expect(ev.level("reporting.dash", "audit.write")).toBe("notify"); // event does not match the allow rule
	});

	it("a null subscriberPath (host subscription) always resolves allow, even under a blanket deny", async () => {
		api = await slothlet(withRules([{ caller: "**", event: "**", effect: "deny" }]));
		expect(api.slothlet.event.level(null, "orders.created")).toBe("allow");
		expect(api.slothlet.event.level("some.module", "orders.created")).toBe("deny"); // a real path still hits the deny
	});

	it("registers nothing — event.level does not create a subscription", async () => {
		api = await slothlet(withRules());
		api.slothlet.event.level("reporting.dash", "orders.created");
		// If event.level had subscribed, this emit would have a listener to deliver to; there is none, so it settles as a no-op.
		await expect(api.slothlet.event.emit("orders.created", { id: 1 })).resolves.toBeUndefined();
	});

	it("agrees with the level an actual subscription at that identity is granted", async () => {
		api = await slothlet(withRules([{ caller: "subscriber.**", event: "grant.*", effect: "allow" }]));
		const actual = await api.subscriber.subscribe("grant.me");
		expect(actual).toBe("allow");
		// The subscriber's identity matches `subscriber.**`; event.level for a path under it agrees.
		expect(api.slothlet.event.level("subscriber.subscribe", "grant.me")).toBe("allow");
	});

	it("throws INVALID_ARGUMENT for an empty event or a non-string, non-null path", async () => {
		api = await slothlet(withRules());
		const ev = api.slothlet.event;
		expect(() => ev.level("x", "")).toThrow(/INVALID_ARGUMENT/);
		expect(() => ev.level(7, "evt")).toThrow(/INVALID_ARGUMENT/);
	});

	it("is host-only: a module caller is refused (PERMISSION_DENIED), never answered", async () => {
		api = await slothlet(withRules());
		const out = await api.probe.attempt("reporting.dash", "orders.created");
		expect(out.ok).toBe(false);
		expect(out.code).toBe("PERMISSION_DENIED");
	});
});
