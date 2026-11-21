/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/callee/ops.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T02:35:48-08:00 (1793702148)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — exported functions and a class whose members hold the module's code without being api nodes
 * of their own: static methods and accessors, a function's own `prototype`, members defined non-enumerable on a
 * function, and a static `toString` / `toJSON`.
 *
 * @module api_tests/api_test_function_members/callee/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * A class with static members.
 * @public
 */
export class Client {
	/**
	 * A static method.
	 * @returns {string} A marker.
	 */
	static open() {
		return "open";
	}

	/**
	 * A static accessor handing out a function.
	 * @returns {function(): string} The function.
	 */
	static get helper() {
		return function helper() {
			return "helper";
		};
	}

	/**
	 * A static `toString` of the class's own.
	 * @returns {string} A marker.
	 */
	static toString() {
		return "Client.toString";
	}

	/**
	 * A static `toJSON` of the class's own.
	 * @returns {string} A marker.
	 */
	static toJSON() {
		return "Client.toJSON";
	}

	/**
	 * A method on the prototype.
	 * @returns {string} A marker.
	 */
	method() {
		return "method";
	}
}

/**
 * A class answering `instanceof` with a test of its own.
 * @public
 */
export class Checker {
	/**
	 * The class's own `instanceof` test.
	 * @param {*} value - The value tested.
	 * @returns {boolean} Whether the value is marked checked.
	 */
	static [Symbol.hasInstance](value) {
		return value?.checked === true;
	}
}

/**
 * A base class no node stands for, reached only through the class extending it.
 */
class Base {
	/**
	 * A static method of the base class.
	 * @returns {string} A marker.
	 */
	static baseStatic() {
		return "baseStatic";
	}
}

/**
 * A class extending one the module does not export.
 * @public
 */
export class Sub extends Base {}

/**
 * A plain function declaration: its own `prototype.constructor` is the function itself.
 * @returns {string} A marker.
 * @public
 */
export function fn() {
	return "fn";
}

Object.defineProperty(fn, "hidden", {
	value: function hidden() {
		return "hidden";
	},
	enumerable: false,
	configurable: true,
	writable: true
});

Object.defineProperty(fn, "hiddenNs", {
	value: {
		deep() {
			return "deep";
		}
	},
	enumerable: false,
	configurable: true,
	writable: true
});

Object.defineProperty(fn, "px", {
	value: new Proxy(
		{},
		{
			get: () => () => "px"
		}
	),
	enumerable: false,
	configurable: true,
	writable: true
});

Object.defineProperty(fn, "label", { value: "data", enumerable: false, configurable: true, writable: true });

/**
 * A function with no name of its own.
 * @public
 */
export const anonymous = (
	() => () =>
		"anonymous"
)();

/**
 * An object node whose members include Proxies holding the module's code.
 * @public
 */
export const obj = {
	/**
	 * A method of the object.
	 * @returns {string} A marker.
	 */
	run() {
		return "run";
	}
};

obj.epx = new Proxy({}, { get: (_target, prop) => (prop === "then" ? undefined : () => "epx") });

Object.defineProperty(obj, "opx", {
	value: new Proxy({}, { get: (_target, prop) => (prop === "then" ? undefined : () => "opx") }),
	enumerable: false,
	configurable: true,
	writable: true
});

/**
 * Reach this module's own members through `self`, as the module is allowed to.
 * @returns {string[]} What each member returned.
 * @public
 * @example
 * ownMembers(); // ["open", "fn", "hidden"]
 */
export function ownMembers() {
	return [self.callee.ops.Client.open(), self.callee.ops.fn.prototype.constructor(), self.callee.ops.fn.hidden()];
}
