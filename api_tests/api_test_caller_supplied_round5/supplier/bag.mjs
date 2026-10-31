/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/supplier/bag.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier's values for the fifth round of caller-supplied-code tests (#597): code nested in what
 * its functions return — members, getters, thenables, iterables, prototypes, statics, own properties of functions —
 * and the plain-JavaScript shape those values keep.
 *
 * @module api_tests/api_test_caller_supplied_round5/supplier/bag
 */

import { self } from "@cldmv/slothlet/runtime";

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
 * What the code the supplier armed got from the vault, newest last.
 * @type {Array<string>}
 * @private
 */
const captured = [];

/**
 * What the supplier's code captured since the last read, cleared as it is read.
 * @returns {Array<string>} The captured answers.
 * @public
 * @example
 * api.supplier.bag.taken(); // ["PERMISSION_DENIED"]
 */
export function taken() {
	return captured.splice(0);
}

/**
 * A class whose static method, prototype method and getter call the vault.
 * @private
 */
class Made {
	constructor(value) {
		this.value = value;
	}

	static stat() {
		return grab();
	}

	m() {
		return grab();
	}

	get g() {
		return grab();
	}
}

/**
 * An iterator prototype whose `next` calls the vault.
 * @type {object}
 * @private
 */
const ITER_PROTO = {
	next() {
		return { value: grab(), done: false };
	}
};

/**
 * Each nested shape, by name: what the callee is handed, and how it runs the supplier's code in it.
 * @type {Object<string, function(): *>}
 * @private
 */
const SHAPES = {
	objFn: () => ({ fn: () => grab() }),
	arrFn: () => [() => grab()],
	getter: () => ({
		get value() {
			return grab();
		}
	}),
	thenable: () => ({
		then(resolve) {
			resolve(grab());
		}
	}),
	iterable: () => ({
		*[Symbol.iterator]() {
			yield grab();
		}
	}),
	asyncIterable: () => ({
		async *[Symbol.asyncIterator]() {
			yield grab();
		}
	}),
	protoIter: () => Object.create(ITER_PROTO),
	ownProp: () => Object.assign(() => "outer", { helper: () => grab() }),
	klass: () => Made,
	instance: () => new Made(1),
	boundPush: () => Object.defineProperty(grab.bind(null), "name", { value: "push" }),
	boundNameless: () => {
		const bound = grab.bind(null);
		delete bound.name;
		return bound;
	},
	frozenGen: () =>
		Object.freeze(
			(function* () {
				yield grab();
			})()
		),
	frozenIter: () =>
		Object.freeze({
			next() {
				return { value: grab(), done: false };
			},
			[Symbol.iterator]() {
				return this;
			}
		}),
	sealedIter: () =>
		Object.preventExtensions({
			next() {
				return { value: grab(), done: false };
			}
		})
};

/**
 * One of the nested shapes.
 * @param {string} name - The shape's name.
 * @returns {*} The shape.
 * @public
 * @example
 * api.supplier.bag.shape("objFn").fn();
 */
export function shape(name) {
	return SHAPES[name]();
}

/**
 * What it is handed, as it is.
 * @param {*} value - Anything.
 * @returns {*} The value.
 * @public
 * @example
 * api.supplier.bag.echo(fn) === fn; // true
 */
export function echo(value) {
	return value;
}

/**
 * The class {@link sameClass} returns too.
 * @returns {Function} The class.
 * @public
 * @example
 * api.supplier.bag.klass() === api.supplier.bag.sameClass(); // true
 */
export function klass() {
	return Made;
}

/**
 * The class {@link klass} returns too.
 * @returns {Function} The class.
 * @public
 * @example
 * api.supplier.bag.sameClass() === api.supplier.bag.klass(); // true
 */
export function sameClass() {
	return Made;
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
 * api.supplier.bag.check(api.supplier.bag.same()); // true
 */
export function check(fn) {
	return fn === grab;
}

/**
 * Whether a list holds the function {@link same} returns.
 * @param {Array<Function>} list - The list.
 * @returns {boolean} True when it does.
 * @public
 * @example
 * api.supplier.bag.isOwnIn([api.supplier.bag.same()]); // true
 */
export function isOwnIn(list) {
	return list.includes(grab);
}

/**
 * A lookup keyed by the function {@link same} returns.
 * @returns {function(*): boolean} Whether a key is known.
 * @public
 * @example
 * api.supplier.bag.keyed()(api.supplier.bag.same()); // true
 */
export function keyed() {
	const known = new Map([[grab, true]]);
	return (key) => known.has(key);
}

/**
 * A generator function.
 * @returns {GeneratorFunction} The function.
 * @public
 * @example
 * util.types.isGeneratorFunction(api.supplier.bag.genFn()); // true
 */
export function genFn() {
	return function* counted(a) {
		yield a;
	};
}

/**
 * An async function.
 * @returns {AsyncFunction} The function.
 * @public
 * @example
 * util.types.isAsyncFunction(api.supplier.bag.asyncFn()); // true
 */
export function asyncFn() {
	return async function awaited(a) {
		return a;
	};
}

/**
 * A generator object.
 * @returns {Generator<number>} The generator.
 * @public
 * @example
 * api.supplier.bag.genObject().next(); // { value: 1, done: false }
 */
export function genObject() {
	return (function* () {
		yield 1;
	})();
}

/**
 * A function reporting its receiver and arguments.
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
 * Register a hook on the callee's ping that captures what the vault answers.
 * @returns {string} The hook's id.
 * @public
 * @example
 * api.supplier.bag.hookCallee();
 */
export function hookCallee() {
	return self.slothlet.hook.on("callee.ops.ping:before", () => {
		captured.push(grab());
	});
}
