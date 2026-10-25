/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-kept-after-async.test.vitest.mjs
 *	@Date: 2026-10-24T21:58:58-07:00 (1792904338)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T10:31:49-07:00 (1792949509)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live runtime: a module using what it kept, from a callback slothlet does not patch, after calling a
 * kept async function (#661).
 *
 * A node a module keeps is read and called as that module wherever it is used. In the live runtime the async call
 * stays suspended after it returns its promise, and the stack in the callback names no suspended call, which
 * refuses an attribution by the stack. The kept node knows its reader, so its own uses are that reader's.
 *
 * Fixture: `api_tests/api_test_live_kept_after_async` — `store` (data and an async function), `probe` (keeps them).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_live_kept_after_async", import.meta.url).pathname;
const LAZY_BASE = new URL("../../../../api_tests/api_test_live_kept_lazy_waiting", import.meta.url).pathname;
const HAS_BASE = new URL("../../../../api_tests/api_test_live_kept_has", import.meta.url).pathname;

/**
 * Poll the probe's outcome.
 * @param {object} api - The api.
 * @returns {Promise<object|null>} The outcome.
 */
const waitOutcome = async (api) => {
	for (let tries = 0; tries < 200; tries++) {
		const outcome = await api.probe.result();
		if (outcome) return outcome;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return null;
};

describe.each([
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" },
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" }
])("a module's kept nodes after it calls a kept async function from a timer (#661) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["allows everything", { defaultPolicy: "allow" }],
		["allows probe to read and call store", { defaultPolicy: "deny", rules: [{ caller: "probe.**", target: "store.**", effect: "allow" }] }]
	])("still reads and calls them when the rules %s", async (_label, permissions) => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions });
		await api.probe.keep();
		await api.probe.useLater();
		expect(await waitOutcome(api)).toEqual({ before: 1, after: 1, again: "object", first: "function" });
	});

	// In the async runtime a getter runs as whoever reads it, so there the code reads as probe, before and after #661.
	it.runIf(runtime === "live")("code another module has a kept node's getter run does not read as the kept node's reader", async () => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "store.box.secret", effect: "deny" }] }
		});
		await api.probe.keepBox();
		await api.rogue.plant();
		let release;
		const held = api.other.hold(new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await api.probe.readBoxLater("evil");
		const outcome = await waitOutcome(api);
		release();
		await held;
		expect(await api.rogue.stolenValue()).not.toBe(42);
		expect(outcome).toEqual({ read: "e" });
	});

	it.runIf(runtime === "live").each([["proxyMember"], ["proxyFn"], ["thisProxy"]])(
		"code another module has run inside a kept node's use (%s) does not read or call as the kept node's reader",
		async (kind) => {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: {
					defaultPolicy: "allow",
					rules: [
						{ caller: "rogue.**", target: "store.box.secret", effect: "deny" },
						{ caller: "rogue.**", target: "store.secretFn", effect: "deny" }
					]
				}
			});
			await api.probe.keepBox();
			await api.probe.keepCallables();
			await api.rogue.plant();
			let release;
			const held = api.other.hold(new Promise((resolve) => (release = resolve)));
			await new Promise((resolve) => setTimeout(resolve, 0));
			await api.probe.useRunningLater(kind);
			await waitOutcome(api);
			release();
			await held;
			const log = await api.rogue.report();
			expect(log.length).toBeGreaterThan(0);
			expect(log.filter((got) => got.secret === 42 || got.call === "S")).toEqual([]);
		}
	);

	it("still refuses them when the rules deny probe", async () => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "store.**", effect: "deny" }] }
		});
		await api.probe.keep();
		await api.probe.useLater();
		expect(await waitOutcome(api)).toEqual({
			before: "PERMISSION_DENIED",
			first: "PERMISSION_DENIED",
			after: "PERMISSION_DENIED",
			again: "PERMISSION_DENIED"
		});
	});
});

describe("a module's node kept before its module loads, read from a timer (#661) — lazy / live", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("code the node's getter runs does not read as the kept node's reader", async () => {
		api = await slothlet({
			base: LAZY_BASE,
			mode: "lazy",
			runtime: "live",
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "sneak.**", target: "store.sub.secret", effect: "deny" }] }
		});
		await api.store.work();
		expect(await api.probe.keep()).toBe("function");
		await api.sneak.plant(api.store.sub);
		let release;
		const held = api.other.hold(new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await api.probe.readLater();
		const outcome = await waitOutcome(api);
		release();
		await held;
		expect(outcome).toEqual({ read: "e" });
		expect(await api.sneak.report()).toEqual(["PERMISSION_DENIED"]);
	});
});

describe.each([{ mode: "eager" }, { mode: "lazy" }])(
	"asking a kept node whether it has a member, from a timer (#661) — $mode / live",
	({ mode }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("code the node runs to answer does not read as the kept node's reader", async () => {
			api = await slothlet({
				base: HAS_BASE,
				mode,
				runtime: "live",
				silent: true,
				permissions: { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "trapmod.tbox.secret", effect: "deny" }] }
			});
			await api.probe.keep();
			await api.rogue.plant();
			let release;
			const held = api.other.hold(new Promise((resolve) => (release = resolve)));
			await new Promise((resolve) => setTimeout(resolve, 0));
			await api.probe.askLater();
			expect(await waitOutcome(api)).toEqual({ has: false });
			release();
			await held;
			expect(await api.rogue.report()).toEqual(["PERMISSION_DENIED"]);
		});
	}
);
