/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/frozen-array-capture.test.vitest.mjs
 *	@Date: 2026-10-24T15:16:48-07:00 (1792880208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T17:24:16-07:00 (1792887856)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frozen arrays read through a module's captured view of a node, with permissions on (#655): read
 * rules apply to every element, and an element keeps the reading module's identity when it is handed on, as an
 * element of an array that is not frozen does.
 *
 * @description
 * Fixture `api_test_frozen_array_capture`:
 * ```
 * store.mjs    prims, objs, nested, fns, deep (frozen arrays); mfns (fns's shape, not frozen); sealed; later; ns (frozen object)
 * probe.mjs    reads store every way, keeps references, hands nodes on
 * friend.mjs   the same as probe, under rules that allow it
 * ```
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_frozen_array_capture", import.meta.url).pathname;

/**
 * Rules denying `probe` each target.
 * @param {string[]} targets - The target patterns.
 * @returns {object} The permissions config.
 */
const denyProbe = (targets) => ({
	defaultPolicy: "allow",
	rules: targets.map((target) => ({ caller: "probe.**", target, effect: "deny" }))
});

/**
 * Run a host-side use of a node, reporting the JSON of what it gave or the code it threw.
 * @param {function(): *} use - The use.
 * @returns {string} The JSON, "fn" for a function, or the error code.
 */
const hostUse = (use) => {
	try {
		const value = use();
		return typeof value === "function" ? "fn" : JSON.stringify(value);
	} catch (error) {
		return error.code ?? `${error.name}: ${error.message}`;
	}
};

/**
 * Follow a path below a node, calling the end when `call` is set.
 * @param {*} node - The node.
 * @param {Array<string|number>} keys - The path.
 * @param {boolean} call - Whether to call the end.
 * @returns {*} What the path gave.
 */
const follow = (node, keys, call) => {
	if (keys.length === 0) return call ? node() : node;
	const holder = keys.slice(0, -1).reduce((at, key) => at[key], node);
	return call ? holder[keys.at(-1)]() : holder[keys.at(-1)];
};

/**
 * Poll a module's later outcome.
 * @param {object} api - The api.
 * @param {string} module - The module.
 * @param {string} id - The outcome's id.
 * @returns {Promise<object|null>} The outcome.
 */
const waitOutcome = async (api, module, id) => {
	for (let tries = 0; tries < 200; tries++) {
		const outcome = await api[module].outcome(id);
		if (outcome) return outcome;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return null;
};

/**
 * Whether a set of outcomes handed over any of the secrets.
 * @param {object} outcomes - The outcomes.
 * @param {string[]} secrets - JSON fragments that must not appear.
 * @returns {boolean} True when one leaked.
 */
const leaked = (outcomes, secrets) => secrets.some((secret) => JSON.stringify(outcomes).includes(secret));

describe.each(getMatrixConfigs({}))("frozen array capture (#655) > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe("1. read rules still apply", () => {
		it.each([
			["prims", ['"value":"1', "[1,2,3]"]],
			["objs", ['\\"a\\":1', '\\"b\\":2']],
			["nested", ["[1,2]", '\\"c\\":3']],
			["deep", ["DEEP", "SOFT"]],
			["sealed", ['\\"s\\":1']],
			["later", ['\\"l\\":1']]
		])("a module denied store.** reads nothing of %s", async (name, secrets) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: denyProbe(["store.**"]) });
			const outcomes = await api.probe.readArray(name);
			expect(leaked(outcomes, secrets)).toBe(false);
			expect(outcomes.spread).toEqual({ error: "PERMISSION_DENIED" });
			expect(outcomes.map).toEqual({ error: "PERMISSION_DENIED" });
			expect(outcomes.stringify).toEqual({ error: "PERMISSION_DENIED" });
		});

		it.each([["prims"], ["objs"], ["nested"], ["deep"], ["sealed"]])(
			"a module denied store.%s.** reads nothing of it, and a sibling stays readable",
			async (name) => {
				api = await slothlet({ ...config, base: BASE, silent: true, permissions: denyProbe([`store.${name}.**`]) });
				const outcomes = await api.probe.readArray(name);
				expect(outcomes.spread).toEqual({ error: "PERMISSION_DENIED" });
				expect(outcomes.map).toEqual({ error: "PERMISSION_DENIED" });
				expect(outcomes.stringify).toEqual({ error: "PERMISSION_DENIED" });
				expect(["PERMISSION_DENIED", undefined]).toContain(outcomes.index.error);
				if (!outcomes.index.error) expect(["{}", "[]"]).toContain(outcomes.index.value);
				expect((await api.probe.readArray(name === "prims" ? "objs" : "prims")).stringify.value).toBeTruthy();
			}
		);

		it("a denied module's element leaf reads are refused at every depth", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: denyProbe(["store.**"]) });
			for (const keys of [
				["prims", 0],
				["objs", 0, "a"],
				["nested", 0, 0],
				["nested", 1, 0, "c"],
				["deep", 0, "a"],
				["deep", 1, "a"],
				["fns", 1, "note"],
				["ns", "list", 0, "z"],
				["ns", "inner", "x"],
				["ns", "frozenInner", "y"]
			]) {
				expect({ keys, outcome: await api.probe.readPath(keys) }).toEqual({ keys, outcome: { error: "PERMISSION_DENIED" } });
			}
		});

		it("an array the host freezes after a first read stays gated for a denied module", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: denyProbe(["store.later.**"]) });
			await api.store;
			expect(api.store.later[0]).toEqual({ l: 1 });
			Object.freeze(api.store.later);
			expect(Object.isFrozen(api.store.later)).toBe(true);
			const outcomes = await api.probe.readArray("later");
			expect(leaked(outcomes, ['\\"l\\":1'])).toBe(false);
			expect(await api.probe.readPath(["later", 0, "l"])).toEqual({ error: "PERMISSION_DENIED" });
			expect(await api.probe.callPath(["later", 1])).toEqual({ error: "PERMISSION_DENIED" });
		});

		it("an allowed module reads every frozen array's values", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: denyProbe(["store.**"]) });
			expect(await api.friend.readArray("objs")).toEqual({
				index: { value: JSON.stringify({ a: 1 }) },
				spread: { value: JSON.stringify([{ a: 1 }, { b: 2 }]) },
				map: { value: JSON.stringify([{ a: 1 }, { b: 2 }]) },
				stringify: { value: JSON.stringify([{ a: 1 }, { b: 2 }]) }
			});
			expect(await api.friend.readPath(["deep", 0, "a"])).toEqual({ value: '"DEEP"' });
			expect(await api.friend.readPath(["nested", 1, 0, "c"])).toEqual({ value: "3" });
			expect(await api.friend.readPath(["ns", "list", 0, "z"])).toEqual({ value: "3" });
			expect(await api.friend.callPath(["fns", 0])).toEqual({ value: '"F0"' });
			expect(await api.friend.callPath(["fns", 1, "run"])).toEqual({ value: '"RUN"' });
		});
	});

	describe("2. captured identity of a fixed member handed out", () => {
		const RULES = denyProbe(["store.fns.**", "store.mfns.**", "store.deep.**", "store.ns.**"]);

		it.each([
			["fns[0]()", ["fns", 0], [], true, ["mfns", 0]],
			["fns[1].run()", ["fns", 1], ["run"], true, ["mfns", 1]],
			["fns[1].note", ["fns", 1], ["note"], false, ["mfns", 1]],
			["fns[2].note (unfrozen object in a frozen array)", ["fns", 2], ["note"], false, ["mfns", 2]],
			["deep[0].a", ["deep", 0], ["a"], false, null],
			["ns.list[0].z", ["ns", "list"], [0, "z"], false, null]
		])("a reference probe took to %s is refused when used outside any call", async (_label, at, keys, call, twin) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: RULES });
			const { node } = await api.probe.give(at);
			const outcome = hostUse(() => follow(node, keys, call));
			if (twin) {
				const { node: twinNode } = await api.probe.give(twin);
				expect(hostUse(() => follow(twinNode, keys, call))).toBe("PERMISSION_DENIED");
			}
			expect(outcome).toBe("PERMISSION_DENIED");
			const { node: friendNode } = await api.friend.give(at);
			expect(hostUse(() => follow(friendNode, keys, call))).not.toBe("PERMISSION_DENIED");
		});

		it.each([
			["fns[0]()", ["fns", 0], [], true],
			["fns[1].note", ["fns", 1], ["note"], false],
			["fns[2].note", ["fns", 2], ["note"], false],
			["mfns[0]()", ["mfns", 0], [], true],
			["mfns[1].note", ["mfns", 1], ["note"], false]
		])("an element %s probe hands to friend keeps probe's floor", async (_label, at, keys, call) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: RULES });
			const now = await api.probe.handTo("friend", "h", at, keys, call);
			const later = await waitOutcome(api, "friend", "h");
			expect(later?.error ?? "allowed").toBe("PERMISSION_DENIED");
			if (!call) expect(now.error ?? "allowed").toBe("PERMISSION_DENIED");
		});

		it.each([
			["fns", 0, [], true],
			["fns", 1, ["run"], true],
			["fns", 1, ["note"], false],
			["deep", 0, ["a"], false]
		])("a reference probe kept to %s[%s] is refused from a timer", async (name, index, keys, call) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: RULES });
			await api.probe.keep("el", [name, index]);
			await api.probe.useLater("el", keys, call);
			expect(await waitOutcome(api, "probe", "el")).toEqual({ error: "PERMISSION_DENIED" });
			await api.probe.keep("arr", [name]);
			await api.probe.useLater("arr", [index, ...keys], call);
			expect(await waitOutcome(api, "probe", "arr")).toEqual({ error: "PERMISSION_DENIED" });
		});
	});

	describe("3. ordinary reads still work", () => {
		it("every shape reads as plain JS through self with permissions on", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			const all = (value) => ({
				index: { value: JSON.stringify(value[0]) },
				spread: { value: JSON.stringify(value) },
				map: { value: JSON.stringify(value) },
				stringify: { value: JSON.stringify(value) }
			});
			expect(await api.probe.readArray("prims")).toEqual(all([1, 2, 3]));
			expect(await api.probe.readArray("objs")).toEqual(all([{ a: 1 }, { b: 2 }]));
			expect(await api.probe.readArray("nested")).toEqual(all([[1, 2], [{ c: 3 }]]));
			expect(await api.probe.readArray("sealed")).toEqual(all([{ s: 1 }, { s: 2 }]));
			expect(await api.probe.readArray("deep")).toEqual(all([{ a: "DEEP" }, { a: "SOFT" }]));
			expect(await api.probe.readPath(["nested", 1, 0, "c"])).toEqual({ value: "3" });
			expect(await api.probe.readPath(["ns", "inner", "x"])).toEqual({ value: "1" });
			expect(await api.probe.readPath(["ns", "frozenInner", "y"])).toEqual({ value: "2" });
			expect(await api.probe.readPath(["ns", "list", 0, "z"])).toEqual({ value: "3" });
			expect(await api.probe.callPath(["ns", "fn"])).toEqual({ value: '"NSFN"' });
			expect(await api.probe.callPath(["fns", 0])).toEqual({ value: '"F0"' });
			expect(await api.probe.callPath(["fns", 1, "run"])).toEqual({ value: '"RUN"' });
			expect(await api.probe.callPath(["fns", 2, "run"])).toEqual({ value: '"RUN2"' });
		});

		it("an array frozen after a first read still reads as plain JS", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			expect((await api.probe.readArray("later")).index).toEqual({ value: JSON.stringify({ l: 1 }) });
			Object.freeze(api.store.later);
			const outcomes = await api.probe.readArray("later");
			expect(outcomes.index).toEqual({ value: JSON.stringify({ l: 1 }) });
			expect(outcomes.spread.value).toBe(JSON.stringify([{ l: 1 }, null]));
			expect(await api.probe.callPath(["later", 1])).toEqual({ value: '"LATER"' });
		});

		it("a frozen array's element is the same object on every read", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			const first = await api.probe.give(["objs", 0]);
			const second = await api.probe.give(["objs", 0]);
			expect(first.node).toBe(second.node);
		});
	});

	describe("4. a kept function reports and behaves as the function does", () => {
		const kinds = ["arrow", "method", "klass", "plain", "bound"];

		it.each(kinds)("a kept %s reports its prototype as the node does", async (kind) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			const node = api.store.kinds[kind];
			const descriptor = Object.getOwnPropertyDescriptor(node, "prototype");
			const expected = {
				own: descriptor !== undefined,
				writable: descriptor?.writable,
				configurable: descriptor?.configurable,
				has: "prototype" in node,
				listed: Reflect.ownKeys(node).includes("prototype")
			};
			await api.probe.keep(kind, ["kinds", kind]);
			await api.probe.describeLater(kind, "prototype");
			const outcome = await waitOutcome(api, "probe", kind);
			expect(outcome).toEqual({ value: JSON.stringify(expected) });
		});

		it.each(["arrow", "method", "bound"])("a kept %s has no prototype, as the function has none", async (kind) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.probe.keep(kind, ["kinds", kind]);
			await api.probe.describeLater(kind, "prototype");
			const outcome = await waitOutcome(api, "probe", kind);
			expect(outcome).toEqual({ value: JSON.stringify({ own: false, has: false, listed: false }) });
		});

		it.each([
			["arrow", '"ARROW"'],
			["method", '"METHOD"'],
			["plain", '"PLAIN"'],
			["bound", '"BOUND"']
		])("a kept %s still calls", async (kind, result) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.probe.keep(kind, ["kinds", kind]);
			await api.probe.useLater(kind, [], true);
			expect(await waitOutcome(api, "probe", kind)).toEqual({ value: result });
		});

		it.each([
			["klass", true],
			["plain", true],
			["bound", true],
			["arrow", false],
			["method", false]
		])("a kept %s constructs exactly when the function does (%s)", async (kind, constructs) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.probe.keep(kind, ["kinds", kind]);
			await api.probe.constructLater(kind);
			const outcome = await waitOutcome(api, "probe", kind);
			if (constructs) expect(outcome).toEqual({ value: '"object"' });
			else expect(outcome.error).toMatch(/^TypeError: /);
		});
	});

	describe("5. a module changing its own arrays, and views kept of them", () => {
		it.each([
			["mut", "freeze"],
			["mut", "seal"],
			["sealedMut", "freeze"]
		])("the owner can close its own %s through self (%s)", async (name, close) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			expect(await api.store.changeOwn(name, { close })).toBe("done");
			expect(close === "freeze" ? Object.isFrozen(api.store[name]) : Object.isSealed(api.store[name])).toBe(true);
		});

		it("a kept view reads what the owner wrote before freezing", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.probe.keep("arr", ["sealedMut"]);
			expect(await api.store.changeOwn("sealedMut", { set: [0, 9] })).toBe("done");
			expect(await api.store.changeOwn("sealedMut", { close: "freeze" })).toBe("done");
			await api.probe.useLater("arr", [0], false);
			expect(await waitOutcome(api, "probe", "arr")).toEqual({ value: "9" });
		});

		it.each([["ns"], ["prims"], ["objs"], ["sealed"], ["mfns"]])("a kept view of %s inspects as the node does", async (name) => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.probe.keep(name, [name]);
			await api.probe.inspectLater(name);
			const outcome = await waitOutcome(api, "probe", name);
			expect(outcome).toEqual({ value: JSON.stringify(util.inspect(api.store[name])) });
		});
	});
});
