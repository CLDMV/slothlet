/**
 * @fileoverview Which event rules module code may add or remove is checked when it adds or removes them, with the
 * permission system off too; the rules it added wait, and apply as added once the system is switched on.
 *
 * @description
 * docs/PERMISSIONS.md ("Event rules", "Declaring Permissions") and docs/EVENTS.md: event rules are evaluated only while
 * the permission system is on, but the limits on what module code may register hold in every mode. A module adds event
 * rules for its own events only, never removes the host's, and its rules rank below the host's; the condition of a rule
 * it adds runs as that module. Under `"off"` (no `permissions` config, or `mode: "off"`) a module reaches
 * `event.rules.add` / `remove` because no call rule is evaluated, so the add-time limits are what hold it. Under
 * `"disabled"` nothing is evaluated either, and the rules a module added there come along when the system is switched
 * on, held to the same limits. The on-mode versions of these checks are in `permissions-module-rule-integrity`.
 *
 * Expected values come from the rules as documented: a refused rule never applies; a host deny outranks a module allow
 * of equal specificity; a module's own deny applies once the system is on.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/` and `guest/`.
 * @module tests/vitests/suites/permissions/permissions-module-event-rules-off
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const attribution of ["precise", "fast"]) CONFIGS.push({ mode, runtime, attribution });
	}
}

// Lets the guest use the event functions once the system is on (an emit from its code included).
const GUEST_EVENTS = { caller: "guest.**", target: "slothlet.event.**", effect: "allow" };

describe.each(CONFIGS)(
	"module event rules with the permission system off — $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the base module, and mount `victim` and the guest code as `guest`.
		 * @param {"none"|"off"|"disabled"} permissionMode - `"none"` passes no `permissions` config (off by default).
		 * @returns {Promise<object>} The composed api.
		 */
		async function load(permissionMode) {
			const permissions =
				permissionMode === "none" ? undefined : { mode: permissionMode, attribution, defaultPolicy: "allow", rules: [GUEST_EVENTS] };
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			return api;
		}

		describe.each(["none", "off"])("permissions %s", (permissionMode) => {
			it("refuses a module an event rule beyond its own events", async () => {
				await load(permissionMode);
				expect(api.slothlet.permissions.control.mode).toBe("off");
				expect(api.guest.x.addEventRuleFor({ caller: "**", event: "**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
				expect(api.guest.x.addEventRuleFor({ caller: "**", event: "victim.**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
				// Nothing was registered: switched on, the victim's own event resolves as with no rule at all.
				api.slothlet.permissions.control.enable();
				expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe("notify");
			});

			it("refuses a module removing the host's event rule, even for the module's own events", async () => {
				await load(permissionMode);
				const hostId = api.slothlet.event.rules.add({ caller: "victim.**", event: "guest.*", effect: "deny" });
				expect(hostId).toMatch(/^evt-/);
				expect(api.guest.x.removeEventRuleFor(hostId)).toBe("INVALID_PERMISSION_RULE");
				api.slothlet.permissions.control.enable();
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
			});
		});

		describe("switched on with control.enable()", () => {
			it("applies the module's own event rules added while off, ranked below the host's", async () => {
				await load("off");
				// While off no event rule is evaluated.
				const own = api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.own.**", effect: "deny" });
				expect(own).toMatch(/^evt-/);
				expect(api.slothlet.event.rules.add({ caller: "victim.**", event: "guest.contested.**", effect: "deny" })).toMatch(/^evt-/);
				expect(api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.contested.**", effect: "allow" })).toMatch(/^evt-/);
				expect(api.guest.x.addEventRuleFor({ caller: "**", event: "victim.**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.own.a")).toBe("allow");
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.contested.a")).toBe("allow");

				api.slothlet.permissions.control.enable();
				expect(api.slothlet.permissions.control.mode).toBe("on");
				// The module's own rule applies.
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.own.a")).toBe("deny");
				// Equal specificity: the host's deny outranks the module's later allow.
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.contested.a")).toBe("deny");
				// The rule refused while off is not there.
				expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe("notify");
				// And the module still removes its own rule.
				expect(api.guest.x.removeEventRuleFor(own)).toBe(true);
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.own.a")).toBe("notify");
			});

			it("holds the condition of a rule the module added while off to the module's own writes", async () => {
				await load("off");
				expect(api.guest.x.addWritingEventCondition("victim.v")).toMatch(/^evt-/);
				api.slothlet.permissions.control.enable();
				api.guest.x.takeConditionWrites();
				api.victim.v.listen("guest.zap");
				await api.guest.x.shout("guest.zap", { n: 1 });
				await new Promise((resolve) => setTimeout(resolve, 20));
				const writes = api.guest.x.takeConditionWrites();
				expect(writes.length).toBeGreaterThan(0);
				expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
				expect(api.victim.v.viaCondition).toBeUndefined();
			});
		});

		describe('permissions mode "disabled", then switched on', () => {
			it("brings the module's event rules along, held to the same limits", async () => {
				await load("disabled");
				expect(api.slothlet.permissions.control.mode).toBe("disabled");
				const own = api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.own.**", effect: "deny" });
				expect(own).toMatch(/^evt-/);
				expect(api.slothlet.event.rules.add({ caller: "victim.**", event: "guest.contested.**", effect: "deny" })).toMatch(/^evt-/);
				expect(api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.contested.**", effect: "allow" })).toMatch(/^evt-/);
				expect(api.guest.x.addEventRuleFor({ caller: "**", event: "victim.**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.own.a")).toBe("allow");

				api.slothlet.permissions.control.enable();
				expect(api.slothlet.permissions.control.mode).toBe("on");
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.own.a")).toBe("deny");
				expect(api.slothlet.event.resolveLevel("victim.v", "guest.contested.a")).toBe("deny");
				expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe("notify");
			});
		});
	}
);
