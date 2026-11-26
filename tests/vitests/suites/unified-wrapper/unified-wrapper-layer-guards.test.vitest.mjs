/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-layer-guards.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The wrapper's class chain is built once, by slothlet: every way to build, extend, register or read it
 * again afterwards is refused, and so is a second set of what the wrapper fills in other files as it loads.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-layer-guards
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const REFUSED = "MODULE_INTERNAL_NOT_IMPORTABLE";

/**
 * The code a call threw with, or "returned" when it did not throw.
 * @param {function(): *} fn - The call.
 * @returns {string} The outcome.
 */
function outcome(fn) {
	try {
		fn();
		return "returned";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

const LAYERS = [
	["values", "ValuesLayer"],
	["nodes", "NodesLayer"],
	["rules", "RulesLayer"],
	["run", "RunLayer"],
	["views", "ViewsLayer"],
	["membrane", "MembraneLayer"],
	["root", "RootLayer"],
	["runtime-bridge", "RuntimeBridgeLayer"],
	["waiting", "WaitingLayer"],
	["materialize", "MaterializeLayer"],
	["traps", "TrapsLayer"]
];

describe("unified-wrapper layers > the chain is built once", () => {
	let api;
	let wrapper;

	beforeAll(async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });
		wrapper = resolveWrapper(api.math);
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("refuses a second build of every layer", async () => {
		for (const [file, factory] of LAYERS) {
			const layer = await import(`#handlers/unified-wrapper/${file}`);
			expect([file, outcome(() => layer[factory](class {}))]).toEqual([file, REFUSED]);
		}
	});

	it("refuses to define, link, record or register anything once the chain is registered", () => {
		class Stray {}
		expect(outcome(() => UnifiedWrapper.define("values", { extra: () => null }))).toBe(REFUSED);
		expect(outcome(() => UnifiedWrapper.linkLayer(Stray, () => {}))).toBe(REFUSED);
		expect(outcome(() => UnifiedWrapper.layer(Stray))).toBe(REFUSED);
		expect(outcome(() => UnifiedWrapper.register(Stray, Symbol("token")))).toBe(REFUSED);
	});

	it("builds no wrapper for a class that extends the chain, or for any class below the registered one", () => {
		class Extended extends UnifiedWrapper {}
		expect(outcome(() => new Extended(wrapper.slothlet, { mode: "eager", apiPath: "x" }))).toBe(REFUSED);
		const below = Reflect.getPrototypeOf(UnifiedWrapper);
		expect(outcome(() => new below(wrapper.slothlet))).toBe(REFUSED);
	});

	it("hands the method table out only at registration: a second registration and a wrong token are refused", () => {
		expect(wrapper).not.toBeNull();
		// A second registration of the real chain, with a token of the same description, is refused.
		expect(outcome(() => UnifiedWrapper.register(UnifiedWrapper, Symbol("slothlet.wrapperToken")))).toBe(REFUSED);
		// A token that is no symbol, or none at all, is refused.
		expect(outcome(() => UnifiedWrapper.register(UnifiedWrapper, "slothlet.wrapperToken"))).toBe(REFUSED);
		expect(outcome(() => UnifiedWrapper.register(UnifiedWrapper))).toBe(REFUSED);
		// No wrapper hands the table out afterwards, genuine or forged.
		const forged = Object.create(UnifiedWrapper.prototype);
		expect(["___methods" in wrapper, "___methods" in forged]).toEqual([false, false]);
	});
});

describe("unified-wrapper layers > what the wrapper fills in other files is set once", () => {
	it("refuses a second set of each of them", async () => {
		const sets = [
			["#helpers/composition", "setApiNodeCheck"],
			["#helpers/class-instance-wrapper", "setModuleInstanceCheck"],
			["#helpers/clone-context", "setCloneViewReader"],
			["#helpers/clone-context", "setCloneNodeReader"],
			["#helpers/function-source-context", "setFunctionSourceReader"],
			["#helpers/run-snapshot", "setKindCheck"],
			["#helpers/run-snapshot", "setProxyCheck"],
			["#handlers/frame-placement", "setResultAttributor"],
			["#handlers/frame-placement", "setModuleNodeResolver"],
			["#handlers/frame-placement", "setHostPrototypeCheck"],
			["#handlers/frame-placement", "setHandedOutCheck"],
			["#handlers/frame-placement", "setInboundOriginal"],
			["#handlers/frame-placement", "setApiValueCheck"]
		];
		// Load slothlet first, so the wrapper has set each of them.
		await import("@cldmv/slothlet");
		for (const [specifier, name] of sets) {
			const file = await import(specifier);
			expect([specifier, name, outcome(() => file[name](() => null))]).toEqual([specifier, name, REFUSED]);
		}
	});
});
