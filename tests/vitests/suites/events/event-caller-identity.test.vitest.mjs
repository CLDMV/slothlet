/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-caller-identity.test.vitest.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:02-08:00 (1794882542)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.caller()` — the current caller object (self-identity: `{ path, module, metadata, version }`), the
 * grow-side counterpart of `event.resolveLevel`. A cross-boundary event-forwarding layer reads it to
 * attribute a far subscription to the subscribing module's REAL identity rather than trusting a
 * caller-supplied one.
 *
 * @description
 * Exercises: the host short-circuit (`null`), a module reading its own dotted path, that it is ungated
 * (a module may read its own identity), and — the load-bearing property — that `caller()` reports the
 * SAME identity `event.on` attributes a subscription to, so `resolveLevel(caller(), evt)` equals the
 * level an actual subscription at that identity is granted. Across the full eager/lazy × async/live matrix.
 *
 * @module tests/vitests/suites/events/event-caller-identity.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

describe.each(getMatrixConfigs())("Events > caller() self-identity > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("returns null for the host (no module caller in context)", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(api.slothlet.caller()).toBe(null);
	});

	it("reports the calling module leaf's own caller object (path segments, module, metadata, version) (ungated — a module may read its own identity)", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const me = await api.whoami.here();
		expect(me.path).toEqual(["whoami", "here"]);
		expect(me.path.join(".")).toBe("whoami.here");
		expect(me.version).toBe(null);
		expect(Object.keys(me).sort()).toEqual(["metadata", "module", "path", "version"]);
	});

	it("reports the identity event.on attributes the subscription to — resolveLevel(caller(), evt) matches the granted level", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				policy: "allow",
				events: { policy: "notify", rules: [{ caller: "whoami.**", event: "orders.*", effect: "allow" }] }
			}
		});
		const { identity, level } = await api.whoami.subscribeAndReport("orders.created");
		expect(identity.path).toEqual(["whoami", "subscribeAndReport"]); // the leaf's own path
		expect(level).toBe("allow"); // whoami.** granted allow for orders.*
		// The host-side resolver, given that identity, agrees with the level the live subscription was granted.
		expect(api.slothlet.event.resolveLevel(identity.path.join("."), "orders.created")).toBe(level);
	});

	it("tracks a rule that would downgrade the same identity — resolveLevel stays in agreement", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				policy: "allow",
				events: { policy: "notify", rules: [{ caller: "whoami.**", event: "secret.*", effect: "deny" }] }
			}
		});
		const { identity, level } = await api.whoami.subscribeAndReport("secret.data");
		expect(level).toBe("deny"); // subscription refused
		expect(api.slothlet.event.resolveLevel(identity.path.join("."), "secret.data")).toBe("deny");
	});
});
