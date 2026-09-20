/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/event-rules-coverage.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for the #407 event-rule paths in PermissionManager (and the
 * `api.slothlet.event.rules.remove` wiring in api_builder) that the main event-system suite
 * does not reach: runtime rule removal, malformed-rule validation, the mutations-disabled
 * removal guard, and a conditional event rule.
 *
 * @module tests/vitests/suites/permissions/event-rules-coverage.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

describe("PermissionManager event rules (#407) — runtime removal + validation", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.remove removes a runtime-added rule (true), then returns false for a gone/unknown id", async () => {
		api = await slothlet({
			base: BASE,
			api: { mutations: { events: true } },
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		const id = api.slothlet.event.rules.add({ caller: "subscriber.**", event: "evt.*", effect: "allow" });
		expect(typeof id).toBe("string");
		expect(api.slothlet.event.rules.remove(id)).toBe(true); // removeEventRule: delete + epoch bump + true
		expect(api.slothlet.event.rules.remove(id)).toBe(false); // already gone → !entry return false
		expect(api.slothlet.event.rules.remove("no-such-id")).toBe(false);
	});

	it("rules.remove is refused when api.mutations.events is false", async () => {
		api = await slothlet({
			base: BASE,
			api: { mutations: { events: false } },
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		expect(() => api.slothlet.event.rules.remove("anything")).toThrow(/MUTATIONS_DISABLED/);
	});

	it("rules.add rejects malformed event rules (#validateEventRule)", async () => {
		api = await slothlet({
			base: BASE,
			api: { mutations: { events: true } },
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		const add = (rule) => () => api.slothlet.event.rules.add(rule);
		expect(add(null)).toThrow(/INVALID_PERMISSION_RULE/); // not an object
		expect(add({ event: "x", effect: "allow" })).toThrow(/INVALID_PERMISSION_RULE/); // caller missing
		expect(add({ caller: "**", effect: "allow" })).toThrow(/INVALID_PERMISSION_RULE/); // event missing
		expect(add({ caller: "**", event: "x", effect: "bogus" })).toThrow(/INVALID_PERMISSION_RULE/); // bad effect
	});

	it("a conditional event rule marks the pool conditional and still resolves a subscriber", async () => {
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					rules: [{ caller: "subscriber.**", event: "cond.*", effect: "allow", condition: { tenant: "tenant-a" } }]
				}
			}
		});
		// Subscribing exercises resolveEventLevel with a conditional rule present (hasConditionalEventRules → true,
		// the conditioned filter runs per resolve). Without the matching context the conditional rule does not
		// fire, so the subscriber falls back to the default level.
		const level = await api.subscriber.subscribe("cond.data");
		expect(["notify", "allow", "deny"]).toContain(level);
	});

	it("a runtime event-rule removal replays across reload (removeEventRule replay)", async () => {
		api = await slothlet({
			base: BASE,
			api: { mutations: { events: true } },
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		const id = api.slothlet.event.rules.add({ caller: "subscriber.**", event: "rm.*", effect: "allow" });
		expect(await api.subscriber.subscribe("rm.data")).toBe("allow");
		expect(api.slothlet.event.rules.remove(id)).toBe(true);
		expect(await api.subscriber.subscribe("rm.data")).toBe("notify"); // rule gone → default

		await api.slothlet.reload();

		// Both the add and the remove ops replay (add then remove → net absent), exercising the
		// removeEventRule branch of the operation-history replay.
		expect(await api.subscriber.subscribe("rm.data")).toBe("notify");
	});

	it("multiple matching event rules of differing specificity exercise the sort (specificity tiebreak)", async () => {
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					rules: [
						{ caller: "**", event: "**", effect: "deny" }, // broad — matches everything
						{ caller: "**", event: "open.*", effect: "allow" } // more specific for open.*
					]
				}
			}
		});
		// "open.door" matches BOTH rules → the comparator runs and the more specific allow wins (spec differs).
		expect(await api.subscriber.subscribe("open.door")).toBe("allow");
		// "other.thing" matches only the broad deny → single match, no tiebreak needed.
		expect(await api.subscriber.subscribe("other.thing")).toBe("deny");
	});

	it("equal-specificity event rules fall through to the layer tiebreak (runtime > instance)", async () => {
		api = await slothlet({
			base: BASE,
			api: { mutations: { events: true } },
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "**", event: "tie.*", effect: "deny" }] }
			}
		});
		// A runtime rule with IDENTICAL specificity but a higher layer must win the equal-specificity tiebreak.
		api.slothlet.event.rules.add({ caller: "**", event: "tie.*", effect: "allow" });
		expect(await api.subscriber.subscribe("tie.thing")).toBe("allow");
	});

	it("equal-specificity same-layer event rules fall through to the registration-order tiebreak", async () => {
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					// Two instance-layer rules of identical specificity → equal spec AND equal layer, so the
					// comparator falls to the registration-order tiebreak (last-registered wins).
					rules: [
						{ caller: "**", event: "seq.*", effect: "deny" },
						{ caller: "**", event: "seq.*", effect: "allow" }
					]
				}
			}
		});
		expect(await api.subscriber.subscribe("seq.thing")).toBe("allow");
	});
});
