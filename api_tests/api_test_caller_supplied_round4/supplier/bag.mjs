/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round4/supplier/bag.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier's api objects for the fourth round of caller-supplied-code tests (#597): code nested on
 * an api object, a Proxy export, generators, and functions and iterators its functions return.
 *
 * @module api_tests/api_test_caller_supplied_round4/supplier/bag
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What the last setter run got from the vault.
 * @type {*}
 * @private
 */
let captured = null;

/**
 * Call the vault's secret, answering with the error code when refused.
 * @returns {string} The secret, or the refusal's code.
 * @private
 */
function grab() {
	try {
		return self.vault.secret.secret();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Record what the vault answered now.
 * @returns {void}
 * @private
 */
function capture() {
	captured = grab();
}

/**
 * What the last setter run got from the vault, cleared as it is read.
 * @returns {*} The captured answer.
 * @public
 * @example
 * api.supplier.bag.taken(); // "PERMISSION_DENIED"
 */
export function taken() {
	const value = captured;
	captured = null;
	return value;
}

/**
 * Code to put on {@link box} at runtime.
 * @returns {object} The members.
 * @public
 * @example
 * api.supplier.bag.parts().setter;
 */
export function parts() {
	return {
		setter: {
			set v(_value) {
				capture();
			}
		},
		iterable: {
			*[Symbol.iterator]() {
				yield grab();
			}
		},
		accessor: {
			get value() {
				return grab();
			}
		}
	};
}

/**
 * An object the supplier puts code on at runtime.
 * @type {object}
 * @public
 */
export const box = { marker: 1 };

/**
 * A Proxy whose read of any of a few names runs the supplier's code.
 * @type {object}
 * @public
 */
export const proxied = new Proxy({}, { get: (_target, prop) => (prop === "x" || prop === "anything" ? grab() : undefined) });

/**
 * A generator yielding what the vault answers.
 * @returns {Generator<string>} The generator.
 * @public
 * @example
 * [...api.supplier.bag.gen()];
 */
export function* gen() {
	yield grab();
}

/**
 * An async generator yielding what the vault answers.
 * @returns {AsyncGenerator<string>} The generator.
 * @public
 * @example
 * for await (const value of api.supplier.bag.agen());
 */
export async function* agen() {
	yield grab();
}

/**
 * An object whose function under a symbol returns a generator.
 * @type {object}
 * @public
 */
export const symbolic = {
	*[Symbol.for("round4.gen")]() {
		yield grab();
	}
};

/**
 * A function calling the vault.
 * @returns {Function} The function.
 * @public
 * @example
 * api.supplier.bag.make()();
 */
export function make() {
	return function made() {
		return grab();
	};
}

/**
 * The same function on every call.
 * @returns {Function} The function.
 * @public
 * @example
 * api.supplier.bag.same() === api.supplier.bag.same(); // true
 */
export function same() {
	return grab;
}

/**
 * Whether a function is the one {@link same} returns.
 * @param {Function} fn - A function.
 * @returns {boolean} True when it is.
 * @public
 * @example
 * api.supplier.bag.isSame(api.supplier.bag.same()); // true
 */
export function isSame(fn) {
	return fn === grab;
}

/**
 * A class, its instances answering with the vault's answer.
 * @returns {Function} The class.
 * @public
 * @example
 * new (api.supplier.bag.makeClass())(1);
 */
export function makeClass() {
	return class Made {
		constructor(value) {
			this.value = value;
			this.answer = grab();
		}
	};
}

/**
 * A function reporting its receiver and arguments, for its plain-JavaScript shape.
 * @returns {Function} The function.
 * @public
 * @example
 * api.supplier.bag.shaped().length; // 2
 */
export function shaped() {
	return function shapedOne(a, b) {
		return [this?.tag, a, b];
	};
}

/**
 * An iterator calling the vault on every step.
 * @returns {Iterator<string>} The iterator.
 * @public
 * @example
 * api.supplier.bag.makeIter().next();
 */
export function makeIter() {
	return {
		next() {
			return { value: grab(), done: false };
		},
		[Symbol.iterator]() {
			return this;
		}
	};
}
