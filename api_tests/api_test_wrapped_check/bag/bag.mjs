/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check/bag/bag.mjs
 *	@Date: 2026-11-08T16:13:51-08:00 (1794183231)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:29-08:00 (1794185789)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module handing out the kinds of values slothlet may put behind its own Proxies, and
 * reading `self.slothlet.wrapped` from module code.
 */

import { self } from "@cldmv/slothlet/runtime";

/** A class whose instances the module hands out. */
export class Thing {
	/** @returns {number} A value. */
	value() {
		return 1;
	}
}

/** Plain data the module exports. */
export const data = { n: 1, list: [1, 2] };

/** What the module's hook saw: whether the `api` it was handed is one of slothlet's own wrappers. */
const seen = [];

/**
 * Make a class instance.
 * @returns {Thing} A new instance.
 */
export function makeThing() {
	return new Thing();
}

/**
 * Make a closure.
 * @returns {Function} A closure.
 */
export function makeFn() {
	return () => 1;
}

/**
 * Ask from module code whether a value is one of slothlet's own Proxies.
 * @param {*} value - The value.
 * @returns {boolean} The answer.
 */
export function check(value) {
	return self.slothlet.wrapped(value);
}

/**
 * Ask about the module's own export read back through `self` (a per-reader view).
 * @returns {{ isProxy: boolean, wrapped: boolean }} What module code sees.
 */
export async function checkOwnView() {
	const { types } = await import("node:util");
	const view = self.bag.data;
	return { isProxy: types.isProxy(view), wrapped: self.slothlet.wrapped(view) };
}

/**
 * A generator function the module hands out.
 * @yields {number} One value.
 */
export function* makeGen() {
	yield 1;
}

/**
 * Make an async function.
 * @returns {Function} An async closure.
 */
export function makeAsyncFn() {
	return async () => 1;
}

/**
 * Make a generator function.
 * @returns {Function} A generator closure.
 */
export function makeGenFn() {
	return function* () {
		yield 1;
	};
}

/**
 * Make a generator object.
 * @returns {Generator} A generator.
 */
export function makeGenObject() {
	return (function* () {
		yield 1;
	})();
}

/**
 * Make a promise, handed back inside an object so the call's own result is not awaited away.
 * @returns {{ promise: Promise<number> }} The promise.
 */
export function makePromise() {
	return { promise: Promise.resolve(1) };
}

/**
 * Ask from module code about the framework views and other wrappers module code sees.
 * @returns {Record<string, boolean>} Each value's answer.
 */
export function checkModuleViews() {
	const answers = {};
	const ask = (name, value) => {
		answers[name] = self.slothlet.wrapped(value);
	};
	ask("self", self);
	ask("self.slothlet", self.slothlet);
	ask("self.slothlet.event", self.slothlet.event);
	ask("self.slothlet.event.on", self.slothlet.event.on);
	ask("self.slothlet.api", self.slothlet.api);
	ask("self.slothlet.hook", self.slothlet.hook);
	ask("self.slothlet.metadata", self.slothlet.metadata);
	ask("self.slothlet.wrapped", self.slothlet.wrapped);
	ask("self.bag", self.bag);
	ask("self.bag.data", self.bag.data);
	ask("self.bag.data.list", self.bag.data.list);
	ask("self.bag.makeThing", self.bag.makeThing);
	ask("self.bag.Thing.prototype", self.bag.Thing.prototype);
	ask("self.bag.Thing.prototype.value", self.bag.Thing.prototype.value);
	return answers;
}

/**
 * Ask from module code about a versioned namespace's dispatcher.
 * @returns {boolean} The answer.
 */
export function checkDispatcher() {
	return self.slothlet.wrapped(self.exts);
}

/**
 * A synchronous function, which an async hook attached to it promotes to returning a promise.
 * @returns {number} A value.
 */
export function syncValue() {
	return 1;
}

/**
 * Register a hook on `syncValue` that records whether the root api view it is handed is one of slothlet's.
 * @returns {string} The hook's id.
 */
export function hookRoot() {
	return self.slothlet.hook.on("bag.syncValue:before", ({ api }) => {
		seen.push(self.slothlet.wrapped(api));
	});
}

/**
 * What the module's hook recorded.
 * @returns {boolean[]} Each answer, in order.
 */
export function hookAnswers() {
	return [...seen];
}
