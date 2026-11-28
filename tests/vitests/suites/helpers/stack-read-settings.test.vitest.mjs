/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/stack-read-settings.test.vitest.mjs
 *	@Date: 2026-11-25T01:22:15-08:00 (1795598535)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:51-08:00 (1795869111)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview How slothlet's stack reader holds and puts back the stack settings it reads with, and what it does when a
 * setting is fixed in place, missing, or the realm it reads from cannot be made.
 *
 * @description
 * The reader holds `Error.prepareStackTrace`, `Error.stackTraceLimit` and the global `Error` as plain values for a read
 * and puts them back exactly as they were: a read-only member stays read-only, a missing one stays missing. A member
 * fixed in place with another value refuses the read. Slothlet's own realm (a `vm` context) is replaced when its frame
 * budget is fixed in place, and the global `Error` is read when no such realm can be made. The cases where Node has no
 * usable `vm` are driven by loading a fresh copy of the reader while `process.getBuiltinModule` answers a stand-in.
 *
 * @module tests/vitests/suites/helpers/stack-read-settings
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readStack, runUnformatted, unreadError, hasEngineStack, stackBudget, stackSites } from "#helpers/stack-read";

const NativeError = globalThis.Error;

/**
 * Restore a property of `Error` to a saved descriptor (or remove it when there was none).
 * @param {string} key - The property.
 * @param {PropertyDescriptor|undefined} saved - The descriptor it had.
 * @returns {void}
 */
function restoreErrorMember(key, saved) {
	if (saved) Object.defineProperty(NativeError, key, saved);
	else delete NativeError[key];
}

/**
 * Load a fresh copy of the stack reader while `process.getBuiltinModule` answers `stand-in` for `node:vm`.
 * @param {function(Function): Function|undefined} makeGetter - Given the real `getBuiltinModule`, the one to load with
 *   (undefined removes it).
 * @returns {Promise<object>} The fresh module.
 */
async function freshReader(makeGetter) {
	const saved = Object.getOwnPropertyDescriptor(process, "getBuiltinModule");
	const real = process.getBuiltinModule;
	const replacement = makeGetter(real);
	if (replacement === undefined) delete process.getBuiltinModule;
	else Object.defineProperty(process, "getBuiltinModule", { ...saved, value: replacement });
	try {
		vi.resetModules();
		return await import("#helpers/stack-read");
	} finally {
		Object.defineProperty(process, "getBuiltinModule", saved);
	}
}

afterEach(() => {
	vi.resetModules();
});

describe("stack-read > holding settings", () => {
	it("defines over a read-only prepareStackTrace for the hold and puts it back read-only", () => {
		const saved = Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace");
		const own = () => "own";
		Object.defineProperty(NativeError, "prepareStackTrace", { value: own, writable: false, enumerable: true, configurable: true });
		try {
			const result = runUnformatted(() => NativeError.prepareStackTrace === own);
			expect(result).toEqual({ held: true, value: false });
			expect(Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace")).toEqual({
				value: own,
				writable: false,
				enumerable: true,
				configurable: true
			});
		} finally {
			restoreErrorMember("prepareStackTrace", saved);
		}
	});

	it("adds a missing prepareStackTrace for the hold and removes it after", () => {
		const saved = Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace");
		delete NativeError.prepareStackTrace;
		try {
			const result = runUnformatted(() => typeof NativeError.prepareStackTrace);
			expect(result).toEqual({ held: true, value: "function" });
			expect(Object.hasOwn(NativeError, "prepareStackTrace")).toBe(false);
		} finally {
			restoreErrorMember("prepareStackTrace", saved);
		}
	});

	it("puts back the global Error when the host replaced it", () => {
		const Replaced = class extends NativeError {};
		globalThis.Error = Replaced;
		try {
			const result = runUnformatted(() => globalThis.Error === NativeError);
			expect(result).toEqual({ held: true, value: true });
			expect(globalThis.Error).toBe(Replaced);
		} finally {
			globalThis.Error = NativeError;
		}
	});

	it("reports a stack read inside the hold as unformatted", () => {
		const error = new NativeError("unread");
		const result = runUnformatted(() => error.stack);
		expect(result.held).toBe(true);
		expect(result.unformatted).toBe(true);
	});
});

describe("stack-read > reading through the global Error", () => {
	it("reads a global error's stack from below a function it skips", () => {
		const error = new NativeError("skip");
		function outer() {
			return readStack(stackSites, { error, skip: outer });
		}
		const read = outer();
		expect(Array.isArray(read.value)).toBe(true);
	});

	it("reads with no frame budget when Error.stackTraceLimit is missing", () => {
		const error = new NativeError("no budget");
		const saved = Object.getOwnPropertyDescriptor(NativeError, "stackTraceLimit");
		let seen = "unset";
		delete NativeError.stackTraceLimit;
		try {
			const read = readStack(
				() => {
					seen = stackBudget();
					return "formatted";
				},
				{ error }
			);
			expect(read).toEqual({ value: "formatted" });
		} finally {
			restoreErrorMember("stackTraceLimit", saved);
		}
		expect(seen).toBeUndefined();
	});

	it("trusts no result the stack getter does not hand back as formatted", () => {
		// NaN is never equal to itself: the stack the getter returns is not taken as the formatter's result.
		expect(readStack(() => NaN, { error: new NativeError("global") })).toBeNull();
		expect(readStack(() => NaN)).toBeNull();
	});
});

describe("stack-read > slothlet's own realm", () => {
	it("formats nothing for one of its errors read outside a read", () => {
		const error = unreadError(4);
		expect(hasEngineStack(error)).toBe(true);
		// The realm's formatter only formats the error a read is reading: any other read gets the engine's default.
		expect(typeof error.stack === "string" || error.stack === undefined).toBe(true);
	});

	it("tells values that are no error with an engine stack", () => {
		expect(hasEngineStack(null)).toBe(false);
		expect(hasEngineStack(42)).toBe(false);
		expect(hasEngineStack("text")).toBe(false);
		expect(hasEngineStack({})).toBe(false);
	});

	it("makes a new realm when the realm's frame budget is fixed in place", () => {
		const first = unreadError(3);
		const FirstError = first.constructor;
		expect(FirstError).not.toBe(NativeError);
		// Writable but not configurable: still held for a read.
		Object.defineProperty(FirstError, "stackTraceLimit", { value: 10, writable: true, configurable: false });
		const second = unreadError(3);
		expect(second.constructor).toBe(FirstError);
		Object.defineProperty(FirstError, "stackTraceLimit", { writable: false });
		// Fixed with another value: the read through it fails and a new realm reads the stack instead.
		const read = readStack(stackSites, { limit: 5 });
		expect(Array.isArray(read.value)).toBe(true);
		const third = unreadError(3);
		expect(third.constructor).not.toBe(FirstError);
		expect(readStack(stackSites, { error: third }).value.length).toBeLessThanOrEqual(3);
	});

	it("makes a new realm for an unread error when the budget is fixed in place", () => {
		const RealmError = unreadError(2).constructor;
		Object.defineProperty(RealmError, "stackTraceLimit", { value: 1, writable: false, configurable: false });
		const next = unreadError(2);
		expect(next.constructor).not.toBe(RealmError);
		expect(hasEngineStack(next)).toBe(true);
	});
});

describe("stack-read > no realm of its own", () => {
	it("reads through the global Error where there is no getBuiltinModule", async () => {
		const fresh = await freshReader(() => undefined);
		const error = fresh.unreadError(5);
		expect(error.constructor).toBe(NativeError);
		const read = fresh.readStack(fresh.stackSites, { limit: 5 });
		expect(Array.isArray(read.value)).toBe(true);
	});

	it("reads through the global Error where vm has no context without contextifying", async () => {
		const fresh = await freshReader((real) => (id) => (id === "node:vm" ? { createContext: real("node:vm").createContext } : real(id)));
		expect(fresh.unreadError(5).constructor).toBe(NativeError);
	});

	it("keeps no realm whose Error is the global one", async () => {
		const fresh = await freshReader(
			(real) => (id) => (id === "node:vm" ? { createContext: () => globalThis, constants: { DONT_CONTEXTIFY: Symbol("plain") } } : real(id))
		);
		expect(fresh.unreadError(5).constructor).toBe(NativeError);
	});

	it("keeps no realm whose formatter is not handed the engine's call sites", async () => {
		// An Error whose instances carry their stack as a value, as an engine with no formatter hook makes them.
		function TextError() {
			Object.defineProperty(this, "stack", { value: "Error\n    at somewhere", writable: true, configurable: true });
		}
		TextError.captureStackTrace = () => {};
		const fresh = await freshReader(
			(real) => (id) =>
				id === "node:vm" ? { createContext: () => ({ Error: TextError }), constants: { DONT_CONTEXTIFY: Symbol("plain") } } : real(id)
		);
		expect(fresh.unreadError(5).constructor).toBe(NativeError);
	});

	it("keeps no realm when making the context throws", async () => {
		const fresh = await freshReader(
			(real) => (id) =>
				id === "node:vm"
					? {
							createContext: () => {
								throw new NativeError("no contexts here");
							},
							constants: { DONT_CONTEXTIFY: Symbol("plain") }
						}
					: real(id)
		);
		expect(fresh.unreadError(5).constructor).toBe(NativeError);
	});

	it("keeps reading from a realm whose budget is fixed when no new realm can be made", async () => {
		let allow = true;
		const fresh = await freshReader((real) => (id) => {
			if (id !== "node:vm") return real(id);
			const vm = real("node:vm");
			return {
				createContext: (...args) => {
					if (!allow) throw new NativeError("no more contexts");
					return vm.createContext(...args);
				},
				constants: vm.constants
			};
		});
		const RealmError = fresh.unreadError(2).constructor;
		expect(RealmError).not.toBe(NativeError);
		Object.defineProperty(RealmError, "stackTraceLimit", { value: 1, writable: false, configurable: false });
		allow = false;
		// The budget cannot be held and no new realm can be made: the capture and the read are refused.
		expect(fresh.unreadError(2)).toBeNull();
		expect(fresh.readStack(fresh.stackSites, { limit: 5 })).toBeNull();
		// Without a limit the fixed budget is read as it is.
		expect(Array.isArray(fresh.readStack(fresh.stackSites).value)).toBe(true);
	});

	it("probes the formatter hook with prepareStackTrace missing as it loads", async () => {
		const saved = Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace");
		delete NativeError.prepareStackTrace;
		let fresh;
		try {
			vi.resetModules();
			fresh = await import("#helpers/stack-read");
			expect(Object.hasOwn(NativeError, "prepareStackTrace")).toBe(false);
		} finally {
			restoreErrorMember("prepareStackTrace", saved);
		}
		expect(Array.isArray(fresh.readStack(fresh.stackSites, { limit: 3 }).value)).toBe(true);
	});
});

// Last: a global `Error` fixed in place cannot be put back in this process.
describe("stack-read > the global Error fixed in place", () => {
	it("refuses the read and the hold when the global Error binding is fixed to another value", () => {
		const Fixed = class extends NativeError {};
		Object.defineProperty(globalThis, "Error", { value: Fixed, writable: false, configurable: false });
		expect(readStack(stackSites, { error: new NativeError("global") })).toBeNull();
		expect(runUnformatted(() => "ran")).toEqual({ held: false });
		expect(globalThis.Error).toBe(Fixed);
	});
});
