/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-function-members.test.vitest.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T02:37:25-08:00 (1793702245)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — members of an api function that hold the module's code (a static method or accessor, a
 * function's own `prototype` and its methods, a member defined non-enumerable on the function, a static `toString` /
 * `toJSON`, an emitter's class and prototype) are not api nodes of their own, so they are handed out as they are. Reaching one is
 * checked as a call of the node it belongs to: a module denied the node is denied its members however it reaches
 * them (dot or bracket access, `Reflect.get`, `.call` / `.apply`, a member of a member, a descriptor, an `await` of
 * an unloaded chain), and a module allowed the node reaches them as before. Data members and `instanceof` are not
 * calls and stay as they were.
 *
 * @module tests/vitests/suites/permissions/permissions-function-members
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_FUNCTION_MEMBERS;

/** The caller module is closed to the whole callee. */
const DENY_CALLEE = [{ caller: "caller.**", target: "callee.**", effect: "deny" }];

/**
 * What each shape returns for a caller allowed the callee, once the callee has loaded.
 * @type {Record<string, *>}
 */
const ALLOWED_LOADED = {
	node: "fn",
	staticMethod: "open",
	bracket: "open",
	reflectGet: "open",
	call: "open",
	apply: "open",
	staticGetter: "helper",
	staticToString: "Client.toString",
	staticToJSON: '"Client.toJSON"',
	prototypeMethod: "method",
	prototypeConstructor: "fn",
	classPrototypeConstructor: "method",
	hiddenMember: "hidden",
	nestedMember: "deep",
	descriptor: "open",
	descriptors: "fn",
	accessorDescriptor: "helper",
	customInstanceOf: true,
	proxyMember: "px",
	objectRun: "run",
	objectProxy: "epx",
	objectHiddenProxy: "opx",
	emitterConstructor: "bus",
	emitterPrototype: "Bus",
	emitterInstanceOf: true
};

/** Shapes that run the callee's code through a member of one of its nodes, once the callee has loaded. */
const MEMBER_CALLS = Object.keys(ALLOWED_LOADED).filter(
	(shape) => !["descriptor", "descriptors", "emitterPrototype", "emitterInstanceOf"].includes(shape)
);

/**
 * What each awaited shape returns for a caller allowed the callee, read before the callee loads in lazy mode.
 * @type {Record<string, *>}
 */
const ALLOWED_AWAITED = {
	awaitedNode: "fn",
	awaitedMember: "open",
	awaitedNested: "method",
	awaitedMissing: "undefined",
	staticMethod: "open",
	prototypeConstructor: "fn",
	hiddenMember: "hidden",
	nestedMember: "deep",
	proxyMember: "px",
	objectProxyAwaited: "epx",
	objectProxyChain: "epx"
};

/**
 * Shapes that take what the node's inspect hook shows and run it, each with the marker its module code returns.
 * @type {Record<string, string>}
 */
const INSPECT_RUNS = {
	inspectHookRun: "fn",
	inspectInherited: "baseStatic",
	inspectDescriptorRun: "fn",
	inspectWaiting: "tool.open"
};

describe.each(getMatrixConfigs())("Permissions > members of an api function (#632) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build an instance over the fixture.
	 * @param {object} [permissions] - The permissions config.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions = { defaultPolicy: "allow", rules: DENY_CALLEE }) => {
		api = await slothlet({ ...config, base: DIR, permissions });
		return api;
	};

	/**
	 * Load the callee's nodes, so a lazy instance reads them as loaded nodes.
	 * @returns {Promise<void>}
	 */
	const load = async () => {
		await api.callee.ops;
		await api.callee.bus;
	};

	/**
	 * Run one shape in the caller module.
	 * @param {string} shape - The shape.
	 * @returns {Promise<{value?: *, error?: string}>} What it did.
	 */
	const attempt = (shape) => withSuppressedSlothletErrorOutput(() => api.caller.probe.attempt(shape));

	it.each(MEMBER_CALLS)("a module denied the node is denied its member: %s", async (shape) => {
		await build();
		await load();
		expect(await attempt(shape)).toEqual({ error: "PERMISSION_DENIED" });
	});

	it.each(Object.keys(ALLOWED_AWAITED))("a module denied the node is denied its member read before the node loads: %s", async (shape) => {
		await build();
		const result = await attempt(shape);
		expect(result).toEqual({ error: "PERMISSION_DENIED" });
	});

	it("a module denied the node is not described the node's code members", async () => {
		await build();
		await load();
		expect(await attempt("descriptor")).toEqual({ value: undefined });
		expect(await attempt("descriptors")).toEqual({ value: undefined });
		// A member the function inherits is no member of its own, so there is nothing to describe or withhold.
		expect(await attempt("inheritedDescriptor")).toEqual({ value: undefined });
	});

	it("a module denied the node still tests instances against it and lists its members", async () => {
		await build();
		await load();
		expect(await attempt("instanceOf")).toEqual({ value: false });
		expect(await attempt("keys")).toEqual({ value: "" });
		// A node that is not callable has no `instanceof` of its own, as an object has none.
		expect((await attempt("objectNodeInstanceOf")).error).toMatch(/not callable/);
		// An emitter of a class of the module's reports the nearest prototype holding none of the module's code.
		expect(await attempt("emitterPrototype")).toEqual({ value: "EventEmitter" });
		expect(await attempt("emitterInstanceOf")).toEqual({ value: true });
	});

	it.each(Object.entries(ALLOWED_LOADED))("a module allowed the node reaches its member: %s", async (shape, expected) => {
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		expect(await attempt(shape)).toEqual({ value: expected });
	});

	it.each(Object.entries(ALLOWED_AWAITED))(
		"a module allowed the node reaches its member before the node loads: %s",
		async (shape, expected) => {
			await build({ defaultPolicy: "allow", rules: [] });
			expect(await attempt(shape)).toEqual({ value: expected });
		}
	);

	it("a frozen node hands its members out from its shell, checked as the unfrozen node's are", async () => {
		await build();
		await load();
		Object.freeze(api.callee.ops.Client);
		Object.freeze(api.callee.ops.fn);
		Object.seal(api.callee.ops.Checker);
		for (const shape of ["staticMethod", "prototypeMethod", "prototypeConstructor", "hiddenMember", "staticToString", "customInstanceOf"]) {
			expect(await attempt(shape)).toEqual({ error: "PERMISSION_DENIED" });
		}
		// A fixed member must be described as it is held, so the description is refused rather than withheld.
		expect(await attempt("descriptor")).toEqual({ error: "PERMISSION_DENIED" });
		expect(await attempt("instanceOf")).toEqual({ value: false });
	});

	it("a frozen node's members reach a module allowed the node", async () => {
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		Object.freeze(api.callee.ops.Client);
		Object.freeze(api.callee.ops.fn);
		Object.seal(api.callee.ops.Checker);
		for (const shape of [
			"staticMethod",
			"prototypeMethod",
			"prototypeConstructor",
			"hiddenMember",
			"descriptor",
			"staticToString",
			"customInstanceOf"
		]) {
			expect(await attempt(shape)).toEqual({ value: ALLOWED_LOADED[shape] });
		}
	});

	it.each([
		["denied", DENY_CALLEE],
		["allowed", []]
	])("the inspect hook shows a module the node, never its runnable code (%s)", async (_label, rules) => {
		await build({ defaultPolicy: "allow", rules });
		await load();
		for (const [shape, marker] of Object.entries(INSPECT_RUNS)) {
			const result = await attempt(shape);
			expect(result.value, shape).not.toBe(marker);
			expect(result.error, shape).toBeDefined();
		}
		expect(await attempt("inspectHook")).toEqual({ value: "string" });
		expect(await attempt("inspectDescriptor")).toEqual({ value: "string" });
		expect((await attempt("inspectEmitter")).value).not.toBe("function");
		// What the hook shows still reads as the function it stands for.
		expect((await attempt("inspectShown")).value).toMatch(/\[Function: fn\]/);
	});

	it("the inspect hook of a node read before it loads shows a module no runnable code", async () => {
		await build();
		for (const [shape, marker] of Object.entries(INSPECT_RUNS)) {
			expect((await attempt(shape)).value, shape).not.toBe(marker);
		}
		expect((await attempt("inspectEmitter")).value).not.toBe("function");
	});

	it("the host still sees the function when it inspects the node", async () => {
		await build();
		await load();
		expect(util.inspect(api.callee.ops.fn)).toMatch(/\[Function: fn\]/);
		expect(util.inspect(api.callee.ops.Client)).toMatch(/\[class Client\]/);
	});

	it("an emitter the host froze reports its module's prototype only to a module allowed the node", async () => {
		await build();
		await load();
		Object.freeze(api.callee.bus);
		expect(await attempt("frozenEmitterMethod")).toEqual({ error: "PERMISSION_DENIED" });
		expect(await attempt("frozenEmitterClass")).toEqual({ error: "PERMISSION_DENIED" });
		await api.shutdown();
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		Object.freeze(api.callee.bus);
		expect(await attempt("frozenEmitterMethod")).toEqual({ value: "bus" });
		expect(await attempt("frozenEmitterClass")).toEqual({ value: "bus" });
		expect(await attempt("emitterInstanceOf")).toEqual({ value: true });
	});

	it("a Proxy an object node holds is reached through its own node, whose reads run the module's traps", async () => {
		await build();
		await load();
		expect(await attempt("objectProxyDescriptor")).toEqual({ error: "PERMISSION_DENIED" });
		expect(await attempt("objectHiddenProxyDescriptor")).toEqual({ error: "PERMISSION_DENIED" });
		await api.shutdown();
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		expect(await attempt("objectProxyDescriptor")).toEqual({ value: "epx" });
		expect(await attempt("objectHiddenProxyDescriptor")).toEqual({ value: "opx" });
	});

	describe.each([
		["freeze", true],
		["seal", true],
		["preventExtensions", true],
		["freeze", false]
	])("an emitter the host closed with %s (read gating %s)", (closing, readGating) => {
		it("still reads as an emitter to a module denied the node, which reaches none of its module's code", async () => {
			await build({ defaultPolicy: "allow", readGating, rules: DENY_CALLEE });
			await load();
			Object[closing](api.callee.bus);
			// A frozen node describes its members as fixed, so a member's value is read as the read gate allows it: the
			// emitter's own `_eventsCount` is module-private data, refused under read gating as it is when not frozen.
			if (closing !== "freeze" || !readGating) expect((await attempt("frozenEmitterKeys")).value).toContain("_events");
			expect(await attempt("frozenEmitterAwait")).toEqual({ value: "object" });
			expect(await attempt("frozenEmitterTag")).toEqual({ value: "[object Object]" });
			expect(await attempt("frozenEmitterPassed")).toEqual({ value: "object" });
			expect(await attempt("emitterInstanceOf")).toEqual({ value: true });
			expect(await attempt("frozenEmitterMethod")).toEqual({ error: "PERMISSION_DENIED" });
			expect(await attempt("frozenEmitterClass")).toEqual({ error: "PERMISSION_DENIED" });
		});
	});

	it("the inspect hook of a module's view of a frozen node shows it when called with no arguments", async () => {
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		Object.freeze(api.callee.ops.obj);
		expect(await attempt("viewInspectRead")).toEqual({ value: "string" });
		expect(await attempt("viewInspectDescriptor")).toEqual({ value: "string" });
	});

	it("the form the inspect hook shows a module is the one util.inspect gives the host", async () => {
		await build({ defaultPolicy: "allow", rules: [] });
		await load();
		expect(await attempt("inspectSubLabel")).toEqual({ value: util.inspect(api.callee.ops.Sub) });
		expect(await attempt("inspectSubLabel")).toEqual({ value: "[class Sub extends Base]" });
		expect(await attempt("inspectAnonymous")).toEqual({ value: util.inspect(api.callee.ops.anonymous) });
	});

	it("the module the node belongs to reaches its own members through self", async () => {
		await build();
		expect(await api.callee.ops.ownMembers()).toEqual(["open", "fn", "hidden"]);
	});

	it("the host reaches the node's members and its instances, awaited or not", async () => {
		await build();
		expect(await (await api.callee.ops.Client.open)()).toBe("open");
		expect(api.callee.ops.Client.open()).toBe("open");
		expect(api.callee.ops.fn.prototype.constructor()).toBe("fn");
		const client = await new api.callee.ops.Client();
		expect(client instanceof api.callee.ops.Client).toBe(true);
	});

	it("the check is the node's call check, made with read gating off as well", async () => {
		await build({ defaultPolicy: "allow", readGating: false, rules: DENY_CALLEE });
		await load();
		expect(await attempt("staticMethod")).toEqual({ error: "PERMISSION_DENIED" });
		expect(await attempt("prototypeConstructor")).toEqual({ error: "PERMISSION_DENIED" });
		// A data member runs no code: it is not checked as a call.
		expect(await attempt("dataMember")).toEqual({ value: "data" });
		// A member holding code is still not described, nor is one holding a Proxy reached.
		expect(await attempt("descriptor")).toEqual({ value: undefined });
		expect(await attempt("proxyMember")).toEqual({ error: "PERMISSION_DENIED" });
	});

	it("nothing is checked with the permission system disabled", async () => {
		await build({ mode: "disabled", rules: DENY_CALLEE });
		await load();
		expect(await attempt("staticMethod")).toEqual({ value: "open" });
		expect(await attempt("descriptor")).toEqual({ value: "open" });
	});
});
