/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/context-helper-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:25:54-08:00 (1795598754)
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
 * @fileoverview Edges of the small context helpers, called directly: the clock lookup, the caller-pinning registry
 * with a strategy that offers only some of its forms, and the promise reactions slothlet registers itself.
 *
 * @description
 * - `clockOf` gives an instance's own clock, or the default one for anything without a clock.
 * - The caller-pinning registry hands callbacks back as they are with no strategy registered, and falls back to the
 *   plain form of a strategy that offers no `scope`, `forResult` (or one that declines) or `idle` form.
 * - `nativeThen` / `pinnedThen` settle their derived promise as `then` would, also when the receiver or
 *   `Promise.prototype` was changed so the engine's own derived promise cannot be handed back as it is.
 *
 * Every case restores what it changed.
 * @module tests/vitests/suites/context/context-helper-edges
 */

import { describe, it, expect, afterEach } from "vitest";
import { clockOf, DEFAULT_CLOCK } from "#helpers/clock";
import {
	setApiCallerPinner,
	pinToCurrentFlow,
	pinScopeToCurrentCaller,
	pinManyForResult,
	holdForCurrentFlow,
	recordOfCurrentFlow
} from "#helpers/caller-pinning";
import { nativeThen, pinnedThen } from "#helpers/promise-context";

describe("Context > helper edges > clockOf", () => {
	it("gives an instance's own clock", () => {
		const clock = { now: () => 5 };
		expect(clockOf({ clock })).toBe(clock);
	});

	it("gives the default clock for anything without one", () => {
		expect(clockOf(null)).toBe(DEFAULT_CLOCK);
		expect(clockOf(undefined)).toBe(DEFAULT_CLOCK);
		expect(clockOf({})).toBe(DEFAULT_CLOCK);
	});
});

describe("Context > helper edges > caller pinning with no strategy", () => {
	afterEach(() => setApiCallerPinner(null));

	it("hands every callback back as it is", () => {
		setApiCallerPinner(null);
		const callback = () => 1;
		expect(pinToCurrentFlow(callback)).toBe(callback);
		expect(pinScopeToCurrentCaller(callback)).toBe(callback);
		expect(holdForCurrentFlow()).toBe(null);
		expect(recordOfCurrentFlow()).toBe(null);
		const callbacks = [callback, undefined];
		expect(pinManyForResult(Promise.resolve(), callbacks)).toBe(callbacks);
	});

	it("hands back what is not a function, strategy or not", () => {
		setApiCallerPinner(() => () => "pinned");
		expect(pinToCurrentFlow(7)).toBe(7);
		expect(pinScopeToCurrentCaller("x")).toBe("x");
	});
});

describe("Context > helper edges > caller pinning with a plain strategy", () => {
	afterEach(() => setApiCallerPinner(null));

	it("pins a scope callback with the plain form when the strategy has no scope form", () => {
		const pinned = () => "pinned";
		setApiCallerPinner(() => pinned);
		expect(pinScopeToCurrentCaller(() => "own")).toBe(pinned);
	});

	it("pins a flow callback with the plain form when the strategy has no idle check", () => {
		const pinned = () => "pinned";
		setApiCallerPinner(() => pinned);
		expect(pinToCurrentFlow(() => "own")).toBe(pinned);
	});

	it("pins result reactions one at a time when forResult declines and there is no many form", () => {
		const strategy = (callback) => () => `pinned:${callback()}`;
		strategy.forResult = () => null;
		setApiCallerPinner(strategy);
		const [fulfilled, rejected] = pinManyForResult(Promise.resolve(), [() => "a", undefined]);
		expect(fulfilled()).toBe("pinned:a");
		expect(rejected).toBe(undefined);
	});

	it("uses forResult's pinning when it gives one", () => {
		const given = [() => "f", () => "r"];
		const strategy = (callback) => callback;
		strategy.forResult = () => given;
		setApiCallerPinner(strategy);
		expect(pinManyForResult(Promise.resolve(), [() => 1, () => 2])).toBe(given);
	});
});

describe("Context > helper edges > promise reactions slothlet registers", () => {
	it("settles with the value when there is no fulfillment reaction, for a receiver with its own constructor", async () => {
		const promise = Promise.resolve(41);
		Object.defineProperty(promise, "constructor", { value: Promise, configurable: true });
		await expect(nativeThen(promise)).resolves.toBe(41);
		await expect(pinnedThen(promise, undefined, undefined)).resolves.toBe(41);
	});

	it("rejects with what the fulfillment reaction throws, for a receiver with its own constructor", async () => {
		const promise = Promise.resolve(1);
		Object.defineProperty(promise, "constructor", { value: Promise, configurable: true });
		await expect(
			nativeThen(promise, () => {
				throw new Error("thrown");
			})
		).rejects.toThrow("thrown");
	});

	it("rejects with the reason when there is no rejection reaction", async () => {
		const promise = Promise.reject(new Error("no"));
		Object.defineProperty(promise, "constructor", { value: Promise, configurable: true });
		await expect(nativeThen(promise, (value) => value)).rejects.toThrow("no");
	});

	it("settles as then would while Promise.prototype.constructor is replaced", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(Promise.prototype, "constructor");
		Object.defineProperty(Promise.prototype, "constructor", { ...descriptor, value: function NotPromise() {} });
		try {
			const derived = nativeThen(Promise.resolve(2), (value) => value * 3);
			expect(derived).toBeInstanceOf(Promise);
			await expect(derived).resolves.toBe(6);
		} finally {
			Object.defineProperty(Promise.prototype, "constructor", descriptor);
		}
	});

	it("settles as then would while Promise.prototype has no constructor", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(Promise.prototype, "constructor");
		delete Promise.prototype.constructor;
		try {
			await expect(nativeThen(Promise.resolve(2), (value) => value + 1)).resolves.toBe(3);
		} finally {
			Object.defineProperty(Promise.prototype, "constructor", descriptor);
		}
	});
});
