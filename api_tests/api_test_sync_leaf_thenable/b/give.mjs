/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_sync_leaf_thenable/b/give.mjs
 *	@Date: 2026-11-03T04:44:33-08:00 (1793709873)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T07:40:04-08:00 (1793720404)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module `b` for the sync-leaf-thenable tests (#599). Every leaf here is a plain (not `async`)
 * function that returns a hand-written thenable whose code calls the vault. Nothing allows `b` to call
 * `c.vault.secret`, so each attempt must be refused, and `c.vault.whoami` must name `b`, even though module
 * `a` is the one awaiting the result.
 *
 * @module api_tests/api_test_sync_leaf_thenable/b/give
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call a vault leaf through `self` and capture the outcome, whether it throws synchronously or rejects.
 * @param {"secret"|"whoami"} target - Which vault leaf.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @private
 */
function attempt(target) {
	try {
		const result = target === "whoami" ? self.c.vault.whoami() : self.c.vault.secret();
		return Promise.resolve(result).then(
			(value) => ({ ok: true, value }),
			(error) => ({ ok: false, code: error?.code ?? String(error) })
		);
	} catch (error) {
		return Promise.resolve({ ok: false, code: error?.code ?? String(error) });
	}
}

/**
 * The issue's repro: `then` calls the vault synchronously.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {{then: function}} A thenable resolving to the outcome.
 * @public
 * @example
 * await api.b.give.syncThen("whoami"); // { ok: true, value: "b.give.syncThen" }
 */
export function syncThen(target = "secret") {
	return {
		then(resolve) {
			resolve(attempt(target));
		}
	};
}

/**
 * `then` calls the vault later, from a timer it schedules.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {{then: function}} A thenable resolving to the outcome.
 * @public
 * @example
 * await api.b.give.timerThen("whoami");
 */
export function timerThen(target = "secret") {
	return {
		then(resolve) {
			setTimeout(() => resolve(attempt(target)), 0);
		}
	};
}

/**
 * `then` calls the vault later, from a microtask it queues.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {{then: function}} A thenable resolving to the outcome.
 * @public
 * @example
 * await api.b.give.microtaskThen("whoami");
 */
export function microtaskThen(target = "secret") {
	return {
		then(resolve) {
			queueMicrotask(() => resolve(attempt(target)));
		}
	};
}

/**
 * `then` is a getter, and both the getter and the function it returns call the vault.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {{then: function}} A thenable resolving to both outcomes.
 * @public
 * @example
 * await api.b.give.getterThen("whoami"); // { getter: {...}, then: {...} }
 */
export function getterThen(target = "secret") {
	return {
		get then() {
			const fromGetter = attempt(target);
			return (resolve) => resolve(Promise.all([fromGetter, attempt(target)]).then(([getter, then]) => ({ getter, then })));
		}
	};
}

/**
 * Hand back the thenable another module's synchronous leaf returned.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {*} Whatever `d.maker.make` returned.
 * @public
 * @example
 * await api.b.give.nested("whoami"); // { ok: true, value: "d.maker.make" }
 */
export function nested(target = "secret") {
	return self.d.maker.make(target);
}

/**
 * The same thenable from an `async` leaf, which the language resolves in this module's own flow.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.b.give.asyncLeaf("whoami"); // { ok: true, value: "b.give.asyncLeaf" }
 */
export async function asyncLeaf(target = "secret") {
	return {
		then(resolve) {
			resolve(attempt(target));
		}
	};
}

/**
 * A native Promise result.
 * @param {*} value - The value to resolve with.
 * @returns {Promise<*>} A resolved Promise.
 * @public
 * @example
 * await api.b.give.native(1); // 1
 */
export function native(value) {
	return Promise.resolve(value);
}

/**
 * A thenable whose `then` rejects.
 * @param {*} reason - The rejection reason.
 * @returns {{then: function}} A rejecting thenable.
 * @public
 * @example
 * await api.b.give.rejects(new Error("x")); // throws
 */
export function rejects(reason) {
	return {
		then(_resolve, reject) {
			reject(reason);
		}
	};
}

/**
 * A thenable whose `then` throws.
 * @param {*} reason - What `then` throws.
 * @returns {{then: function}} A thenable whose `then` throws.
 * @public
 * @example
 * await api.b.give.throws(new Error("x")); // throws
 */
export function throws(reason) {
	return {
		then() {
			throw reason;
		}
	};
}

/**
 * A thenable whose `then` resolves, then throws: the first settlement wins.
 * @param {*} value - The value to resolve with.
 * @returns {{then: function}} The thenable.
 * @public
 * @example
 * await api.b.give.resolvesThenThrows(1); // 1
 */
export function resolvesThenThrows(value) {
	return {
		then(resolve) {
			resolve(value);
			throw new Error("ignored");
		}
	};
}

/**
 * A thenable whose `then` never settles.
 * @returns {{then: function}} A thenable that never settles.
 * @public
 * @example
 * api.b.give.never(); // never settles when awaited
 */
export function never() {
	return {
		then() {}
	};
}

/**
 * A thenable resolving to a plain value, to observe what hooks see.
 * @param {*} value - The value to resolve with.
 * @returns {{then: function}} The thenable.
 * @public
 * @example
 * await api.b.give.value(2); // 2
 */
export function value(value) {
	return {
		then(resolve) {
			resolve(value);
		}
	};
}

/**
 * Outcomes recorded by code this module handed out that runs at an unknown time (a message getter, a Proxy
 * trap), drained by {@link drain}.
 * @type {Array<Promise<object>>}
 */
const recorded = [];

/**
 * Hand back and clear the outcomes recorded so far.
 * @returns {Promise<Array<object>>} The settled outcomes.
 * @public
 * @example
 * await api.b.give.drain(); // [{ ok: false, code: "PERMISSION_DENIED" }]
 */
export function drain() {
	return Promise.all(recorded.splice(0));
}

/**
 * Build an Error whose `message` (or `name`) is a getter that calls the vault each time it is read.
 * @param {"secret"|"whoami"} target - Which vault leaf.
 * @param {boolean} inherited - Put the getter on a prototype instead of the error itself.
 * @param {"message"|"name"} prop - Which property is the getter.
 * @returns {Error} The error.
 * @private
 */
function errorWithGetter(target, inherited, prop) {
	const descriptor = {
		get() {
			recorded.push(attempt(target));
			return prop === "name" ? "Error" : "m";
		},
		configurable: true
	};
	const error = new Error("x");
	if (inherited) {
		const proto = Object.create(Error.prototype);
		Object.defineProperty(proto, prop, descriptor);
		delete error[prop];
		Object.setPrototypeOf(error, proto);
	} else {
		Object.defineProperty(error, prop, descriptor);
	}
	return error;
}

/**
 * Throw an Error whose `message` (or `name`) getter calls the vault.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @param {"throw"|"reject"|"thenable"} [how="throw"] - Throw it, return a rejected Promise, or return a
 *   thenable that rejects with it.
 * @param {boolean} [inherited=false] - Put the getter on a prototype instead of the error itself.
 * @param {"message"|"name"} [prop="message"] - Which property is the getter.
 * @returns {never|Promise<never>|{then: function}} Never returns normally.
 * @public
 * @example
 * await api.b.give.failWithGetter("whoami"); // throws; the getter's calls are recorded
 */
export function failWithGetter(target = "secret", how = "throw", inherited = false, prop = "message") {
	const error = errorWithGetter(target, inherited, prop);
	if (how === "reject") return Promise.reject(error);
	if (how === "thenable") {
		return {
			then(_resolve, reject) {
				reject(error);
			}
		};
	}
	throw error;
}

/**
 * Return a Proxy whose `get` trap calls the vault on every read, `then` included.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {object} The Proxy.
 * @public
 * @example
 * await api.b.give.proxy("whoami"); // the trap's calls are recorded
 */
export function proxy(target = "secret") {
	return new Proxy(
		{},
		{
			get() {
				recorded.push(attempt(target));
				return undefined;
			}
		}
	);
}

/**
 * The symbol slothlet once marked a reported error with; a module can name it.
 * @type {symbol}
 */
const PROCESSED_MARK = Symbol.for("@cldmv/slothlet/hook-error-processed");

/**
 * The traps a Proxy error records itself through: every one slothlet could run on it.
 * @type {Array<string>}
 */
const PROXY_TRAPS = [
	"get",
	"set",
	"has",
	"defineProperty",
	"deleteProperty",
	"getOwnPropertyDescriptor",
	"getPrototypeOf",
	"setPrototypeOf",
	"ownKeys",
	"isExtensible",
	"preventExtensions"
];

/**
 * Build an error carrying code of this module's that runs when the error is examined.
 * @param {"processedGetter"|"proxy"|"constructorGetter"|"staticName"|"forgedMark"} kind - Where the code sits.
 * @param {"secret"|"whoami"} target - Which vault leaf the code calls.
 * @returns {object} The error.
 * @private
 */
function errorCarrying(kind, target) {
	const record = () => recorded.push(attempt(target));
	if (kind === "processedGetter") {
		const error = new Error("x");
		Object.defineProperty(error, PROCESSED_MARK, {
			get() {
				record();
				return false;
			},
			set() {
				record();
			},
			configurable: true
		});
		return error;
	}
	if (kind === "proxy") {
		const handler = {};
		for (const trap of PROXY_TRAPS) {
			handler[trap] = (...args) => {
				record();
				return Reflect[trap](...args);
			};
		}
		return new Proxy(new Error("x"), handler);
	}
	if (kind === "constructorGetter") {
		const error = new Error("x");
		Object.defineProperty(error, "constructor", {
			get() {
				record();
				return Error;
			},
			configurable: true
		});
		return error;
	}
	if (kind === "staticName") {
		class NamedError extends Error {
			static get name() {
				record();
				return "NamedError";
			}
		}
		return new NamedError("x");
	}
	// forgedMark: the old processed mark set by hand, with a `name` getter behind it.
	const error = new Error("x");
	error[PROCESSED_MARK] = true;
	Object.defineProperty(error, "name", {
		get() {
			record();
			return "Error";
		},
		configurable: true
	});
	return error;
}

/**
 * Fail with an error carrying code of this module's (see {@link errorCarrying}).
 * @param {"processedGetter"|"proxy"|"constructorGetter"|"staticName"|"forgedMark"} kind - Where the code sits.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf the code calls.
 * @param {"throw"|"reject"|"thenable"} [how="throw"] - Throw it, return a rejected Promise, or return a
 *   thenable that rejects with it.
 * @returns {never|Promise<never>|{then: function}} Never returns normally.
 * @public
 * @example
 * await api.b.give.failWith("proxy", "whoami"); // throws; the traps' calls are recorded
 */
export function failWith(kind, target = "secret", how = "throw") {
	const error = errorCarrying(kind, target);
	if (how === "reject") return Promise.reject(error);
	if (how === "thenable") {
		return {
			then(_resolve, reject) {
				reject(error);
			}
		};
	}
	throw error;
}

/**
 * Throw what it is handed, as it is.
 * @param {*} error - What to throw.
 * @returns {never} Never returns.
 * @public
 * @example
 * api.b.give.rethrow(new Error("orig")); // throws that same Error
 */
export function rethrow(error) {
	throw error;
}

/**
 * Hand out an object whose method, run later by whoever holds it, throws an error carrying code of this module's.
 * @param {"message"|"proxy"|"processedGetter"|"constructorGetter"|"staticName"} [kind="message"] - The error: one with
 *   a `message` getter, or one of {@link errorCarrying}'s.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf its code calls.
 * @returns {{boom: function(): never}} The object.
 * @public
 * @example
 * const made = await api.b.give.made("proxy");
 * made.boom(); // throws
 */
export function made(kind = "message", target = "secret") {
	return {
		boom() {
			throw kind === "message" ? errorWithGetter(target, false, "message") : errorCarrying(kind, target);
		}
	};
}
