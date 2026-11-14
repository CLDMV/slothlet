/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-rule-specificity.test.vitest.mjs
 *	@Date: 2026-11-13T09:30:00-08:00 (1794591000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T23:20:21-08:00 (1794640821)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The more specific event rule wins, whatever the order (#767).
 *
 * A pattern's specificity is its kind (an exact name, then a single-segment glob, then a multi-segment glob), and
 * among patterns of one kind the one with more literal segments (`guest.zz.**` over `guest.**` over `**`). A rule's
 * specificity is its caller pattern's plus its event pattern's. Order breaks a tie only between equally specific
 * rules, after the layer (runtime over instance over manifest over built-in).
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

/**
 * Every ordering of a list.
 * @param {Array<*>} list - The items.
 * @returns {Array<Array<*>>} The permutations.
 */
const orderings = (list) =>
	list.length <= 1
		? [list]
		: list.flatMap((item, i) => orderings([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));

describe.each(getMatrixConfigs())("Events > rule specificity (#767) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the events api with permissions on and an optional set of instance-layer rules.
	 * @param {Array<object>} [rules=[]] - Instance-layer event rules.
	 * @param {object} [permissions={}] - Further permissions options.
	 * @returns {Promise<void>}
	 */
	const load = async (rules = [], permissions = {}) => {
		api = await slothlet({
			...config,
			base: BASE,
			silent: true,
			permissions: { defaultPolicy: "allow", events: { default: "notify", rules }, ...permissions }
		});
	};

	/**
	 * The level for a subscriber and event with `rules` added at runtime in the order given.
	 * @param {Array<object>} rules - Runtime event rules, in registration order.
	 * @param {string} subscriber - The subscriber's api path.
	 * @param {string} event - The event name.
	 * @returns {string} The resolved level.
	 */
	const levelWith = (rules, subscriber, event) => {
		const ids = rules.map((rule) => api.slothlet.event.rules.add(rule));
		try {
			return api.slothlet.event.resolveLevel(subscriber, event);
		} finally {
			for (const id of ids) api.slothlet.event.rules.remove(id);
		}
	};

	const rule = (event, effect, caller = "**") => ({ caller, event, effect });

	it("lets guest.zz.** beat guest.** for guest.zz.a in either order, and leaves guest.b to the broad rule", async () => {
		await load();
		const narrow = rule("guest.zz.**", "deny");
		const broad = rule("guest.**", "allow");
		expect(levelWith([narrow, broad], "m", "guest.zz.a")).toBe("deny");
		expect(levelWith([broad, narrow], "m", "guest.zz.a")).toBe("deny");
		expect(levelWith([narrow, broad], "m", "guest.b")).toBe("allow");
		expect(levelWith([broad, narrow], "m", "guest.b")).toBe("allow");
	});

	it("ranks a.b.** over a.** over ** in every order", async () => {
		await load();
		const rules = [rule("a.b.**", "deny"), rule("a.**", "allow"), rule("**", "notify")];
		for (const order of orderings(rules)) {
			expect(levelWith(order, "m", "a.b.c")).toBe("deny");
			expect(levelWith(order, "m", "a.x")).toBe("allow");
			expect(levelWith(order, "m", "z")).toBe("notify");
		}
	});

	it("ranks a single-segment glob over a multi-segment glob, and an exact name over both, in every order", async () => {
		await load();
		for (const order of orderings([rule("a.*", "deny"), rule("a.**", "allow")])) {
			expect(levelWith(order, "m", "a.x")).toBe("deny");
		}
		for (const order of orderings([rule("a.b.c", "deny"), rule("a.b.*", "allow"), rule("a.b.**", "notify")])) {
			expect(levelWith(order, "m", "a.b.c")).toBe("deny");
		}
	});

	it("lets the later rule win between equally specific patterns", async () => {
		await load();
		// `*.x` and `a.*` are both a single-segment glob with one literal segment, and both match a.x.
		expect(levelWith([rule("*.x", "deny"), rule("a.*", "allow")], "m", "a.x")).toBe("allow");
		expect(levelWith([rule("a.*", "allow"), rule("*.x", "deny")], "m", "a.x")).toBe("deny");
		expect(levelWith([rule("a.**", "deny"), rule("a.**", "allow")], "m", "a.x")).toBe("allow");
	});

	it("ranks the caller pattern the same way", async () => {
		await load();
		const narrow = rule("**", "deny", "guest.zz.**");
		const broad = rule("**", "allow", "guest.**");
		for (const order of orderings([narrow, broad])) {
			expect(levelWith(order, "guest.zz.m", "e")).toBe("deny");
			expect(levelWith(order, "guest.other", "e")).toBe("allow");
		}
	});

	it("adds the caller pattern's specificity to the event pattern's", async () => {
		await load();
		// Narrower caller and broader event against broader caller and narrower event: equal totals, so the later wins.
		const callerNarrow = rule("x.**", "deny", "guest.zz.**");
		const eventNarrow = rule("x.y.**", "allow", "guest.**");
		expect(levelWith([callerNarrow, eventNarrow], "guest.zz.m", "x.y.z")).toBe("allow");
		expect(levelWith([eventNarrow, callerNarrow], "guest.zz.m", "x.y.z")).toBe("deny");
		// A rule narrower on both outranks one broader on both.
		const both = rule("x.y.**", "deny", "guest.zz.**");
		const neither = rule("x.**", "allow", "guest.**");
		for (const order of orderings([both, neither])) expect(levelWith(order, "guest.zz.m", "x.y.z")).toBe("deny");
	});

	it("applies to rules in the config, in either order", async () => {
		await load([rule("guest.zz.**", "deny"), rule("guest.**", "allow")]);
		expect(api.slothlet.event.resolveLevel("m", "guest.zz.a")).toBe("deny");
		await api.shutdown();
		await load([rule("guest.**", "allow"), rule("guest.zz.**", "deny")]);
		expect(api.slothlet.event.resolveLevel("m", "guest.zz.a")).toBe("deny");
	});

	it("still lets the higher layer win a tie, and a narrower rule win over a higher layer's broader one", async () => {
		await load([rule("guest.**", "allow")]);
		// Runtime over instance at equal specificity, whichever was registered last.
		expect(levelWith([rule("guest.**", "deny")], "m", "guest.zz.a")).toBe("deny");
		// A narrower instance rule is not overridden by a broader runtime rule.
		await api.shutdown();
		await load([rule("guest.zz.**", "allow")]);
		expect(levelWith([rule("guest.**", "deny")], "m", "guest.zz.a")).toBe("allow");
		expect(levelWith([rule("guest.**", "deny")], "m", "guest.b")).toBe("deny");
	});

	it("ranks a module's manifest rule below the host's at equal specificity and above a broader host rule", async () => {
		// The fixture module's manifest declares `{ caller: "subscriber.**", event: "manifest.*", effect: "allow" }`.
		const FIX = new URL("../../../../api_tests/api_test_events_module", import.meta.url).pathname;
		await load([rule("manifest.*", "deny", "subscriber.**")]);
		await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX } });
		expect(api.slothlet.event.resolveLevel("subscriber.x", "manifest.data")).toBe("deny");
		await api.shutdown();

		await load([rule("**", "deny")]);
		await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX } });
		expect(api.slothlet.event.resolveLevel("subscriber.x", "manifest.data")).toBe("allow");
	});

	it.each(["off", "disabled"])("evaluates nothing under mode %s", async (mode) => {
		await load([rule("guest.zz.**", "deny"), rule("guest.**", "allow")], { mode });
		expect(api.slothlet.event.resolveLevel("m", "guest.zz.a")).toBe("allow");
	});
});
