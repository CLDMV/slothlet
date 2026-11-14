/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-rule-specificity.test.vitest.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The more specific call, write and hook rule wins, whatever the order (#770).
 *
 * A pattern's specificity is its kind (an exact name, then a single-segment glob, then a multi-segment glob), and among
 * patterns of one kind the one with more literal segments (`db.write.**` over `db.**` over `**`). A rule's specificity is
 * its caller pattern's plus its target pattern's; a hook rule adds a point for a specific hook type over `hook`. Layer
 * (runtime over instance over manifest over built-in) and then registration order break a tie between equally specific
 * rules only, as they do for event rules (#767).
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { PermissionManager } from "#handlers/permission-manager";
import { SlothletError } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Every ordering of a list.
 * @param {Array<*>} list - The items.
 * @returns {Array<Array<*>>} The permutations.
 */
const orderings = (list) =>
	list.length <= 1
		? [list]
		: list.flatMap((item, i) => orderings([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));

const rule = (target, effect, caller = "**") => ({ caller, target, effect });

describe("Permissions > rule specificity (#770) > the rule manager", () => {
	/** @type {PermissionManager[]} */
	const managers = [];

	afterEach(async () => {
		for (const manager of managers.splice(0)) await manager.shutdown();
	});

	/**
	 * A manager with the system on and `defaultPolicy`, holding `rules` added in the order given, each at its layer.
	 * @param {Array<object>} rules - Rules; a `layer` field names the layer it is added at.
	 * @param {object} [permissions={}] - Further `permissions` options.
	 * @returns {PermissionManager} The manager.
	 */
	const build = (rules, permissions = {}) => {
		const manager = new PermissionManager({
			config: { permissions: { mode: "on", defaultPolicy: "allow", ...permissions } },
			handlers: {},
			debug() {},
			SlothletError
		});
		managers.push(manager);
		for (const { layer, ...entry } of rules) manager.addRule(entry, null, null, layer ?? null);
		return manager;
	};

	describe("call rules", () => {
		it("lets db.write.** beat db.** for db.write.x in either order, and leaves db.read.x to the broad rule", () => {
			for (const order of orderings([rule("db.**", "allow"), rule("db.write.**", "deny")])) {
				const manager = build(order);
				expect(manager.checkAccess("a.b", "db.write.x")).toBe(false);
				expect(manager.checkAccess("a.b", "db.read.x")).toBe(true);
			}
			for (const order of orderings([rule("db.**", "deny"), rule("db.write.**", "allow")])) {
				const manager = build(order);
				expect(manager.checkAccess("a.b", "db.write.x")).toBe(true);
				expect(manager.checkAccess("a.b", "db.read.x")).toBe(false);
			}
		});

		it("ranks a.b.** over a.** over ** in every order", () => {
			for (const order of orderings([rule("a.b.**", "deny"), rule("a.**", "allow"), rule("**", "deny")])) {
				const manager = build(order, { defaultPolicy: "deny" });
				expect(manager.checkAccess("m.n", "a.b.c")).toBe(false);
				expect(manager.checkAccess("m.n", "a.x")).toBe(true);
				expect(manager.checkAccess("m.n", "z")).toBe(false);
			}
		});

		it("keeps the kind first: a single-segment glob beats a multi-segment glob with more literal segments", () => {
			for (const order of orderings([rule("a.*", "deny"), rule("a.b.**", "allow")])) {
				// a.b matches both: `a.*` is the single-segment glob (kind 2), `a.b.**` the multi-segment glob with more literals (kind 1).
				expect(build(order).checkAccess("m.n", "a.b")).toBe(false);
			}
			for (const order of orderings([rule("a.b.c", "deny"), rule("a.b.*", "allow"), rule("a.b.**", "allow")])) {
				expect(build(order).checkAccess("m.n", "a.b.c")).toBe(false);
			}
		});

		it("ranks the caller pattern's literal segments the same way", () => {
			const narrow = rule("**", "deny", "guest.zz.**");
			const broad = rule("**", "allow", "guest.**");
			for (const order of orderings([narrow, broad])) {
				const manager = build(order);
				expect(manager.checkAccess("guest.zz.m", "x")).toBe(false);
				expect(manager.checkAccess("guest.other", "x")).toBe(true);
			}
		});

		it("adds the caller pattern's literal segments to the target pattern's", () => {
			// Narrower caller and broader target against broader caller and narrower target: equal totals, so the later wins.
			const callerNarrow = rule("x.**", "deny", "guest.zz.**");
			const targetNarrow = rule("x.y.**", "allow", "guest.**");
			expect(build([callerNarrow, targetNarrow]).checkAccess("guest.zz.m", "x.y.z")).toBe(true);
			expect(build([targetNarrow, callerNarrow]).checkAccess("guest.zz.m", "x.y.z")).toBe(false);
			// A rule narrower on both outranks one broader on both.
			const both = rule("x.y.**", "deny", "guest.zz.**");
			const neither = rule("x.**", "allow", "guest.**");
			for (const order of orderings([both, neither])) expect(build(order).checkAccess("guest.zz.m", "x.y.z")).toBe(false);
		});

		it("lets the later rule win between equally specific patterns", () => {
			// `*.x` and `a.*` are both a single-segment glob with one literal segment, and both match a.x.
			expect(build([rule("*.x", "deny"), rule("a.*", "allow")]).checkAccess("m.n", "a.x")).toBe(true);
			expect(build([rule("a.*", "allow"), rule("*.x", "deny")]).checkAccess("m.n", "a.x")).toBe(false);
			expect(build([rule("a.**", "deny"), rule("a.**", "allow")]).checkAccess("m.n", "a.x")).toBe(true);
		});

		it("still lets the higher layer win a tie, and lets a narrower rule win over a higher layer's broader one", () => {
			const at = (layer, target, effect) => ({ ...rule(target, effect), layer });
			// Runtime over instance at equal specificity, whichever was registered last.
			expect(build([at("runtime", "guest.**", "deny"), at("instance", "guest.**", "allow")]).checkAccess("m.n", "guest.a")).toBe(false);
			expect(build([at("instance", "guest.**", "allow"), at("runtime", "guest.**", "deny")]).checkAccess("m.n", "guest.a")).toBe(false);
			// A narrower instance rule is not overridden by a broader runtime rule, and a narrower manifest rule is not
			// overridden by a broader host rule.
			expect(build([at("instance", "guest.zz.**", "allow"), at("runtime", "guest.**", "deny")]).checkAccess("m.n", "guest.zz.a")).toBe(
				true
			);
			expect(build([at("runtime", "guest.**", "deny"), at("instance", "guest.zz.**", "allow")]).checkAccess("m.n", "guest.b")).toBe(false);
			expect(build([at("manifest", "guest.zz.**", "allow"), at("instance", "guest.**", "deny")]).checkAccess("m.n", "guest.zz.a")).toBe(
				true
			);
			// Equal specificity across layers: the host's rule over the manifest's.
			expect(build([at("manifest", "guest.**", "allow"), at("instance", "guest.**", "deny")]).checkAccess("m.n", "guest.a")).toBe(false);
		});

		it("answers again after a narrower rule is added, and after it is removed", () => {
			const manager = build([rule("db.**", "allow")]);
			expect(manager.checkAccess("a.b", "db.write.x")).toBe(true);
			const id = manager.addRule(rule("db.write.**", "deny"));
			expect(manager.checkAccess("a.b", "db.write.x")).toBe(false);
			manager.removeRule(id);
			expect(manager.checkAccess("a.b", "db.write.x")).toBe(true);
		});

		it.each(["off", "disabled"])("evaluates nothing under mode %s", (mode) => {
			const manager = build([rule("db.**", "allow"), rule("db.write.**", "deny")], { mode });
			expect(manager.checkAccess("a.b", "db.write.x")).toBe(true);
		});
	});

	describe("write rules", () => {
		const write = (target, effect) => rule(`${target}:write`, effect);

		it("lets x.y.** beat x.** for a write to x.y.z in either order", () => {
			for (const order of orderings([write("x.**", "allow"), write("x.y.**", "deny")])) {
				const manager = build(order);
				expect(manager.decideWrite("a.b", "x.y.z")).toBe("deny");
				expect(manager.decideWrite("a.b", "x.q")).toBe("grant");
			}
			for (const order of orderings([write("x.**", "deny"), write("x.y.**", "allow")])) {
				const manager = build(order);
				expect(manager.decideWrite("a.b", "x.y.z")).toBe("grant");
				expect(manager.decideWrite("a.b", "x.q")).toBe("deny");
			}
		});

		it("keeps the kind first, ranks the caller pattern, and lets the later rule win an equal tie", () => {
			for (const order of orderings([write("a.*", "deny"), write("a.b.**", "allow")]))
				expect(build(order).decideWrite("m.n", "a.b")).toBe("deny");
			const narrow = { ...write("**", "deny"), caller: "guest.zz.**" };
			const broad = { ...write("**", "allow"), caller: "guest.**" };
			for (const order of orderings([narrow, broad])) expect(build(order).decideWrite("guest.zz.m", "x")).toBe("deny");
			expect(build([write("*.x", "deny"), write("a.*", "allow")]).decideWrite("m.n", "a.x")).toBe("grant");
			expect(build([write("a.*", "allow"), write("*.x", "deny")]).decideWrite("m.n", "a.x")).toBe("deny");
		});

		it("lets a narrower instance rule win over a broader runtime rule", () => {
			const at = (layer, target, effect) => ({ ...write(target, effect), layer });
			expect(build([at("instance", "x.y.**", "allow"), at("runtime", "x.**", "deny")]).decideWrite("m.n", "x.y.z")).toBe("grant");
			expect(build([at("instance", "x.**", "allow"), at("runtime", "x.**", "deny")]).decideWrite("m.n", "x.y.z")).toBe("deny");
		});
	});

	describe("hook rules", () => {
		const hook = (target, effect, caller = "**") => rule(target, effect, caller);

		it("lets db.write.**:hook beat db.**:hook for a hook on db.write.x in either order", () => {
			for (const order of orderings([hook("db.**:hook", "allow"), hook("db.write.**:hook", "deny")])) {
				const manager = build(order);
				expect(manager.checkHookAccess("a.b", "db.write.x", "before")).toBe(false);
				expect(manager.checkHookAccess("a.b", "db.read.x", "before")).toBe(true);
			}
		});

		it("ranks the same hook type by literal segments, in either order", () => {
			for (const order of orderings([hook("db.**:before", "deny"), hook("db.write.**:before", "allow")])) {
				const manager = build(order, { defaultPolicy: "deny" });
				expect(manager.checkHookAccess("a.b", "db.write.x", "before")).toBe(true);
				expect(manager.checkHookAccess("a.b", "db.read.x", "before")).toBe(false);
			}
		});

		it("keeps a specific hook type over the any type whatever the literal segments", () => {
			for (const order of orderings([hook("db.**:before", "deny"), hook("db.write.**:hook", "allow")])) {
				expect(build(order).checkHookAccess("a.b", "db.write.x", "before")).toBe(false);
			}
		});

		it("ranks the caller pattern, and lets the later rule win an equal tie", () => {
			const narrow = hook("**:hook", "deny", "guest.zz.**");
			const broad = hook("**:hook", "allow", "guest.**");
			for (const order of orderings([narrow, broad])) {
				const manager = build(order);
				expect(manager.checkHookAccess("guest.zz.m", "x", "before")).toBe(false);
				expect(manager.checkHookAccess("guest.other", "x", "before")).toBe(true);
			}
			expect(build([hook("*.x:hook", "deny"), hook("a.*:hook", "allow")]).checkHookAccess("m.n", "a.x", "before")).toBe(true);
			expect(build([hook("a.*:hook", "allow"), hook("*.x:hook", "deny")]).checkHookAccess("m.n", "a.x", "before")).toBe(false);
		});
	});
});

const FIXTURE = TEST_DIRS.API_TEST_PERMISSIONS;
const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];
const ATTRIBUTIONS = ["precise", "fast"];

describe.each(CONFIGS)("Permissions > rule specificity (#770) > an instance > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Compose the permissions fixture with call rules in the config.
	 * @param {Array<object>} rules - The rules, in the order given.
	 * @param {string} attribution - `"precise"` or `"fast"`.
	 * @returns {Promise<void>}
	 */
	const load = async (rules, attribution) => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
	};

	/** What calling `payments.charge.process` as the payments caller answers. */
	const charge = async () => {
		try {
			const result = await api.callers.paymentsCaller.callCharge(100);
			return result.ok === true ? "allowed" : "failed";
		} catch (error) {
			return error.code;
		}
	};

	describe.each(ATTRIBUTIONS)("attribution %s", (attribution) => {
		it("refuses a call a narrower deny covers under a broader allow, in either order", async () => {
			for (const order of orderings([rule("payments.**", "allow", "callers.**"), rule("payments.charge.**", "deny", "callers.**")])) {
				await load(order, attribution);
				expect(await charge()).toBe("PERMISSION_DENIED");
				expect(api.slothlet.permissions.global.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process")).toBe(false);
				expect(api.slothlet.permissions.global.checkAccess("callers.paymentsCaller.callCharge", "payments.webhook.handleWebhook")).toBe(
					true
				);
				await api.shutdown();
				api = null;
			}
		});

		it("allows a call a narrower allow covers under a broader deny, in either order", async () => {
			for (const order of orderings([rule("payments.**", "deny", "callers.**"), rule("payments.charge.**", "allow", "callers.**")])) {
				await load(order, attribution);
				expect(await charge()).toBe("allowed");
				expect(api.slothlet.permissions.global.checkAccess("callers.paymentsCaller.callCharge", "payments.webhook.handleWebhook")).toBe(
					false
				);
				await api.shutdown();
				api = null;
			}
		});

		it("lets a narrower rule added at runtime win over a broader one in the config, and the reverse by layer at a tie", async () => {
			await load([rule("payments.charge.**", "allow", "callers.**")], attribution);
			const broad = api.slothlet.permissions.addRule(rule("payments.**", "deny", "callers.**"));
			expect(await charge()).toBe("allowed");
			api.slothlet.permissions.removeRule(broad);
			const equal = api.slothlet.permissions.addRule(rule("payments.charge.**", "deny", "callers.**"));
			expect(await charge()).toBe("PERMISSION_DENIED");
			api.slothlet.permissions.removeRule(equal);
			expect(await charge()).toBe("allowed");
		});
	});

	it.each(["off", "disabled"])("evaluates nothing under mode %s", async (permissionsMode) => {
		api = await slothlet({
			base: FIXTURE,
			mode,
			runtime,
			silent: true,
			permissions: {
				mode: permissionsMode,
				rules: [rule("payments.**", "allow", "callers.**"), rule("payments.charge.**", "deny", "callers.**")]
			}
		});
		expect(await charge()).toBe("allowed");
	});
});
