/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/clone-views-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:40:29-08:00 (1795599629)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:23-08:00 (1795869083)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Cloning values that hold slothlet's views, with stand-in readers, and the clone patch on odd hosts.
 *
 * @description
 * `helpers/clone-context` copies the value behind each of slothlet's views (and an api node's data) when the platform
 * refuses to clone a value that holds one. The handlers that make views tell it how to read them; here stand-in
 * readers say which objects are views and what they stand over, so the copying itself can be checked against what
 * `structuredClone` gives for the same data without views:
 *
 * - a value with no view the platform refuses: its refusal stands;
 * - two views of one object: one copy, shared, as `structuredClone` keeps one object reached twice;
 * - symbol keys are left out, as the platform leaves them out;
 * - a node standing over built-in data whose kind this engine's copy does not know, or an error whose `name` throws;
 * - `structuredClone()` with no argument: the platform's own TypeError.
 *
 * The patch is also loaded over stand-in builtins: a `v8.serialize` that throws when read, that cannot be replaced,
 * or whose host refuses or throws on the write; an engine without `Error.isError`, `Float16Array` or some
 * `ArrayBuffer` / `RegExp` getters; and a browser global with its own `postMessage`.
 * @module tests/vitests/suites/context/clone-views-edges
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cloneTakingViews, isClonePatched, enableClonePatching, disableClonePatching } from "#helpers/clone-context";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

let copies = 0;

/**
 * A copy of `helpers/clone-context` loaded over replaced imports.
 * @param {object} [intrinsics] - Members of `#helpers/intrinsics` replaced.
 * @param {object} [platform] - Members of `#helpers/platform` replaced.
 * @returns {Promise<object>} The copy.
 */
async function copyWith(intrinsics = {}, platform = {}) {
	vi.doMock("#helpers/intrinsics", async (importOriginal) => ({ ...(await importOriginal()), ...intrinsics }));
	vi.doMock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), ...platform }));
	try {
		return await import(`${pathToFileURL(internalLibPath("helpers/clone-context.mjs")).href}?edges=${++copies}`);
	} finally {
		vi.doUnmock("#helpers/intrinsics");
		vi.doUnmock("#helpers/platform");
	}
}

/**
 * Stand-in views: a Proxy over each object, which the platform refuses to clone, read back by the view reader.
 * @param {object} module - The module whose readers to set.
 * @returns {function(object): object} Makes a view of an object.
 */
function standInViews(module) {
	const behind = new WeakMap();
	module.setCloneViewReader((value) => (value !== null && typeof value === "object" ? behind.get(value) : undefined));
	return (target) => {
		const view = new Proxy(target, {});
		behind.set(view, target);
		return view;
	};
}

afterEach(() => {
	disableClonePatching();
});

describe("Context > clone views > copying", () => {
	it("lets the platform's refusal stand for a value with no view", () => {
		expect(() => cloneTakingViews({ fn() {} })).toThrow();
	});

	it("copies one object reached through two views once, shared, as structuredClone keeps it", async () => {
		const { cloneTakingViews, setCloneViewReader } = await copyWith();
		const view = standInViews({ setCloneViewReader });
		const data = { n: 1 };
		const first = view(data);
		const second = view(data);
		const copy = cloneTakingViews({ first, second, again: first });
		const plain = structuredClone({ first: data, second: data, again: data });
		expect(copy).toEqual(plain);
		expect(copy.first).toBe(copy.second);
		expect(copy.again).toBe(copy.first);
	});

	it("copies the value a view stands for when it is a primitive", async () => {
		const { cloneTakingViews, setCloneViewReader } = await copyWith();
		const view = new Proxy({}, {});
		setCloneViewReader((value) => (value === view ? 42 : undefined));
		expect(cloneTakingViews({ answer: view })).toEqual({ answer: 42 });
	});

	it("leaves out symbol keys, as the platform does", async () => {
		const { cloneTakingViews, setCloneViewReader } = await copyWith();
		const view = standInViews({ setCloneViewReader });
		const copy = cloneTakingViews({ [Symbol("hidden")]: 1, shown: view({ a: 1 }) });
		expect(copy).toEqual({ shown: { a: 1 } });
		expect(Object.getOwnPropertySymbols(copy)).toEqual([]);
	});

	it("copies an error a node stands over as an Error when reading its name throws", async () => {
		const { cloneTakingViews, setCloneNodeReader } = await copyWith();
		const error = new TypeError("bad");
		Object.defineProperty(error, "name", {
			get() {
				throw new Error("no name");
			}
		});
		const node = new Proxy({}, {});
		setCloneNodeReader((value) => (value === node ? { slots: error, members: error } : undefined));
		const copy = cloneTakingViews({ node });
		expect(copy.node).toBeInstanceOf(Error);
		expect(Object.getPrototypeOf(copy.node)).toBe(Error.prototype);
		expect(copy.node.message).toBe("bad");
	});

	it("copies a node standing over data reached through a view of the node", async () => {
		const { cloneTakingViews, setCloneViewReader, setCloneNodeReader } = await copyWith();
		const view = standInViews({ setCloneViewReader });
		const date = new Date(5);
		const node = new Proxy({}, {});
		setCloneNodeReader((value) => (value === node ? { slots: date, members: date } : undefined));
		const viewOfNode = view(node);
		const copy = cloneTakingViews({ a: viewOfNode, b: node });
		expect(copy.a).toEqual(new Date(5));
		expect(copy.b).toBe(copy.a);
	});
});

describe("Context > clone views > the installed patch", () => {
	it("throws the platform's own error for a call with no argument", () => {
		enableClonePatching();
		expect(isClonePatched(globalThis.structuredClone)).toBe(true);
		expect(() => structuredClone()).toThrow(TypeError);
		disableClonePatching();
		disableClonePatching();
		expect(isClonePatched(globalThis.structuredClone)).toBe(false);
	});

	it("tells a wrapper from anything else", () => {
		expect(isClonePatched(5)).toBe(false);
		expect(isClonePatched(() => {})).toBe(false);
		expect(isClonePatched(Object.assign(() => {}, { [Symbol.for("slothlet.clone.original")]: () => {} }))).toBe(true);
	});

	it("passes straight through in a copy disabled under another copy's wrapper", async () => {
		const lower = await copyWith();
		const other = await copyWith();
		lower.enableClonePatching();
		other.enableClonePatching();
		lower.disableClonePatching();
		const view = standInViews(lower);
		// The lower wrapper passes through, the upper one copies what the views stand over with its own reader.
		const ownView = standInViews(other);
		expect(structuredClone({ a: ownView({ x: 1 }) })).toEqual({ a: { x: 1 } });
		expect(() => structuredClone({ a: view({ x: 1 }) })).toThrow();
		other.disableClonePatching();
	});
});

describe("Context > clone views > hosts that differ", () => {
	it("skips a serialize that throws when read, cannot be replaced, or whose host refuses the write", async () => {
		const serialize = (value) => value;
		/**
		 * A host whose own descriptors throw once `state.throws` is set.
		 * @param {{throws: boolean}} state - The switch.
		 * @returns {object} The host.
		 */
		const throwingHost = (state) =>
			new Proxy(
				{ serialize },
				{
					getOwnPropertyDescriptor(target, key) {
						if (state.throws) throw new Error("no descriptor");
						return Reflect.getOwnPropertyDescriptor(target, key);
					}
				}
			);
		const atLoad = { throws: true };
		const atEnable = { throws: false };
		const frozen = Object.freeze({ serialize });
		const refusing = new Proxy({ serialize }, { defineProperty: () => false });
		const failing = new Proxy(
			{ serialize },
			{
				defineProperty() {
					throw new Error("no define");
				}
			}
		);
		for (const [host, state] of [
			[throwingHost(atLoad), null],
			[throwingHost(atEnable), atEnable],
			[frozen, null],
			[refusing, null],
			[failing, null]
		]) {
			const copy = await copyWith({ Processes: { getBuiltinModule: (id) => (id === "node:v8" ? host : undefined) } });
			if (state) state.throws = true;
			copy.enableClonePatching();
			if (state) state.throws = false;
			expect(host.serialize).toBe(serialize);
			copy.disableClonePatching();
		}
	});

	it("follows another copy's wrapper down to the platform's function as it loads", async () => {
		const native = (value) => value;
		const wrapped = (value) => native(value);
		wrapped[Symbol.for("slothlet.clone.original")] = native;
		const v8 = { serialize: wrapped };
		const copy = await copyWith({ Processes: { getBuiltinModule: (id) => (id === "node:v8" ? v8 : undefined) } });
		copy.enableClonePatching();
		expect(copy.isClonePatched(v8.serialize)).toBe(true);
		copy.disableClonePatching();
		expect(v8.serialize).toBe(wrapped);
	});

	it("skips a host member that is no function", async () => {
		const v8 = { serialize: 5 };
		const copy = await copyWith({ Processes: { getBuiltinModule: (id) => (id === "node:v8" ? v8 : undefined) } });
		copy.enableClonePatching();
		expect(v8.serialize).toBe(5);
		copy.disableClonePatching();
	});

	it("patches nothing more in a browser global with no postMessage of its own", async () => {
		const copy = await copyWith({}, { isNode: false });
		copy.enableClonePatching();
		expect(copy.isClonePatched(globalThis.structuredClone)).toBe(true);
		copy.disableClonePatching();
		expect(copy.isClonePatched(globalThis.structuredClone)).toBe(false);
	});

	it("loads where the platform gives no getBuiltinModule", async () => {
		const copy = await copyWith({ Processes: {} });
		expect(copy.isClonePatched(globalThis.structuredClone)).toBe(false);
	});

	it("patches a browser global's own postMessage", async () => {
		const postMessage = () => {};
		globalThis.postMessage = postMessage;
		try {
			const copy = await copyWith({}, { isNode: false });
			copy.enableClonePatching();
			expect(copy.isClonePatched(globalThis.postMessage)).toBe(true);
			copy.disableClonePatching();
			expect(globalThis.postMessage).toBe(postMessage);
		} finally {
			delete globalThis.postMessage;
		}
	});

	it("copies on an engine without Error.isError, Float16Array or newer buffer and pattern getters", async () => {
		const { PrototypeFunctions } = await import("#helpers/intrinsics");
		const ErrorStandIn = function Error(message) {
			return new globalThis.Error(message);
		};
		ErrorStandIn.prototype = globalThis.Error.prototype;
		const copy = await copyWith({
			Error: ErrorStandIn,
			Float16Array: undefined,
			PrototypeFunctions: {
				...PrototypeFunctions,
				RegExp: { ...PrototypeFunctions.RegExp, unicodeSets: undefined, hasIndices: undefined },
				ArrayBuffer: { byteLength: PrototypeFunctions.ArrayBuffer.byteLength },
				SharedArrayBuffer: {}
			}
		});
		const nodes = new Map();
		const nodeOf = (data) => {
			const node = new Proxy({}, {});
			nodes.set(node, data);
			return node;
		};
		copy.setCloneNodeReader((value) => (nodes.has(value) ? { slots: nodes.get(value), members: nodes.get(value) } : undefined));
		const error = new RangeError("range");
		const pattern = /a/gi;
		const bytes = new Uint8Array([1, 2]);
		const result = copy.cloneTakingViews({
			error: nodeOf(error),
			pattern: nodeOf(pattern),
			bytes: nodeOf(bytes)
		});
		expect(result.error).toBeInstanceOf(RangeError);
		expect(result.error.message).toBe("range");
		expect(result.pattern.source).toBe("a");
		expect(result.pattern.flags).toBe("gi");
		expect([...result.bytes]).toEqual([1, 2]);
		// Data a node stands over that is no built-in kind the copy knows: the platform's refusal stands.
		expect(() => copy.cloneTakingViews({ other: nodeOf({ plain: true }) })).toThrow();
		if (typeof Float16Array === "function") {
			// Not a kind this copy knows: the platform's refusal stands.
			expect(() => copy.cloneTakingViews({ half: nodeOf(new Float16Array([1])) })).toThrow();
		}
	});
});
