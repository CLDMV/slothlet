/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routine-manager-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:31:03-08:00 (1795599063)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:24-08:00 (1795600284)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview RoutineManager arms the integration suites do not reach: a contribution on a path no module owns,
 * captures with no api path, wrapper bookkeeping when a speculative build is reverted, a mode run recording a
 * contributor that has no tracked wrapper, a negated bare routine in lazy mode, and asking a mode that never ran.
 *
 * @module tests/vitests/suites/lifecycle/routine-manager-arms.test.vitest
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
	delete globalThis.__slothletRoutineLog;
});

/**
 * Build an instance over the routines fixture and return its routine manager.
 * @param {object} [opts] - Extra slothlet options.
 * @returns {Promise<{api: object, rm: object}>} The api and its routine manager.
 * @example
 * const { rm } = await build({ mode: "eager" });
 */
async function build(opts = {}) {
	api = await slothlet({
		silent: true,
		base: TEST_DIRS.API_TEST_ROUTINES,
		mode: "eager",
		routines: { entries: [{ name: "^ghost", mode: "manual" }] },
		...opts
	});
	const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;
	return { api, rm };
}

describe("RoutineManager — contributions and paths", () => {
	it("runs a contribution on a path no module owns", async () => {
		const { rm } = await build({ routines: { entries: [{ name: "^ghost", mode: "manual" }], stack: false } });
		rm.onImplCreated({ apiPath: "ghost", moduleID: "ghost-mod", wrapper: { ____impl: () => "ghost-ran" } });
		expect(await rm.runPath("ghost")).toBe("ghost-ran");
	});

	it("records a contributor without a tracked wrapper in a mode run, with or without the module's wrapper map", async () => {
		const { rm, api: built } = await build();
		const fn = () => "ran";
		rm.onImplCreated({ apiPath: "ghost", moduleID: "ghost-mod", wrapper: { ____impl: fn } });
		rm.activeModeRun = new Set();
		expect(await rm.runPath("ghost")).toBe("ran");
		expect(rm.activeModeRun.has(fn)).toBe(true);
		// The module now tracks a wrapper for another path only.
		rm.onImplCreated({ apiPath: "ping", moduleID: "ghost-mod", wrapper: { ____impl: fn }, ____wrapperRef: built.ping });
		rm.activeModeRun = new Set();
		expect(await rm.runPath("ghost")).toBe("ran");
		expect(rm.activeModeRun.size).toBe(1);
		rm.activeModeRun = null;
	});

	it("ignores a capture with no api path", async () => {
		const { rm } = await build();
		const before = rm.raw.length;
		rm.onImplCreated({ apiPath: "", moduleID: "m", wrapper: { ____impl: () => {} } });
		rm.onImplCreated({ moduleID: "m", wrapper: { ____impl: () => {} } });
		expect(rm.raw.length).toBe(before);
	});

	it("answers true for a root hook a mode run invoked", async () => {
		const { rm } = await build({ routines: { auto: true, entries: [{ name: "^initialize", mode: "shutdown" }] } });
		const fn = rm.raw.find((e) => e.apiPath === "initialize").fn;
		await rm.runShutdownModeRoutines();
		expect(rm.ranInModeRun("shutdown", fn)).toBe(true);
	});

	it("answers false for a mode that never ran", async () => {
		const { rm } = await build();
		expect(rm.ranInModeRun("never-ran", () => {})).toBe(false);
	});
});

describe("RoutineManager — reverting wrapper bookkeeping", () => {
	it("revertRawEntry drops the tracked wrapper when the prior contribution had none", async () => {
		const { rm, api: built } = await build();
		const prior = () => "prior";
		rm.onImplCreated({ apiPath: "ghost", moduleID: "rv-mod", wrapper: { ____impl: () => "cand" }, ____wrapperRef: built.ping });
		expect(rm.rawWrappers.get("rv-mod").has("ghost")).toBe(true);
		rm.revertRawEntry("ghost", "rv-mod", { fn: prior, index: 0 });
		expect(rm.rawWrappers.get("rv-mod").has("ghost")).toBe(false);
		expect(rm.raw.find((e) => e.moduleID === "rv-mod").fn).toBe(prior);
	});

	it("revertSpeculativeSubtree drops the tracked wrapper when the prior contribution had none", async () => {
		const { rm, api: built } = await build();
		const prior = () => "prior";
		rm.onImplCreated({ apiPath: "ghost", moduleID: "st-mod", wrapper: { ____impl: () => "cand" }, ____wrapperRef: built.ping });
		rm.revertSpeculativeSubtree({}, "st-mod", "ghost", new Map([["ghost", { fn: prior, index: 0 }]]));
		expect(rm.rawWrappers.get("st-mod").has("ghost")).toBe(false);
		expect(rm.raw.find((e) => e.moduleID === "st-mod").fn).toBe(prior);
	});

	it("revertSpeculativeState invalidates the candidate's wrapper and restores the prior one", async () => {
		const { rm } = await build();
		const prior = () => "prior";
		rm.onImplCreated({ apiPath: "ghost", moduleID: "ss-mod", wrapper: { ____impl: () => "cand" } });
		const candidate = { ___invalidate: vi.fn() };
		const priorWrapper = { ___invalidate: vi.fn() };
		rm.rawWrappers.set("ss-mod", new Map([["ghost", candidate]]));
		rm.revertSpeculativeState("ss-mod", new Map([["ghost", { fn: prior, index: 0, wrapper: priorWrapper }]]));
		expect(candidate.___invalidate).toHaveBeenCalledTimes(1);
		expect(rm.rawWrappers.get("ss-mod").get("ghost")).toBe(priorWrapper);
		expect(rm.raw.find((e) => e.moduleID === "ss-mod").fn).toBe(prior);
	});
});

describe("RoutineManager — reverting a module with no tracked wrappers", () => {
	it("restores the prior contribution without touching wrapper tracking", async () => {
		const { rm } = await build();
		const prior = () => "prior";
		rm.onImplCreated({ apiPath: "ghost", moduleID: "nw-mod", wrapper: { ____impl: () => "cand" } });
		rm.revertSpeculativeState("nw-mod", new Map([["ghost", { fn: prior, index: 0, wrapper: { ___invalidate() {} } }]]));
		expect(rm.rawWrappers.has("nw-mod")).toBe(false);
		expect(rm.raw.find((e) => e.moduleID === "nw-mod").fn).toBe(prior);
	});
});

describe("RoutineManager — a negated bare routine in lazy mode", () => {
	it("loads each mount's top level and runs every match but the named one", async () => {
		const { rm } = await build({ mode: "lazy", routines: { entries: [{ name: "!ping", mode: "manual" }] } });
		await rm.runCascade("!ping");
		expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize"]);
	});
});
