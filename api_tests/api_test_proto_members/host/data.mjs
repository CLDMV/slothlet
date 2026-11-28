/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_proto_members/host/data.mjs
 *	@Date: 2026-11-22T12:39:59-08:00 (1795379999)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:15-08:00 (1795868955)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Objects whose methods come from their prototype: one made with `Object.create`, one a class instance.
 * @module api_test_proto_members/host/data
 */

/** The prototype `obj` inherits from. */
const base = {
	/**
	 * An inherited method.
	 * @returns {string} A greeting.
	 */
	hello() {
		return "hi";
	},
	/**
	 * An inherited method answering its receiver.
	 * @returns {object} `this`.
	 */
	me() {
		return this;
	},
	/** Inherited data. */
	shared: 5
};

/** @type {object} An object holding one member of its own, the rest inherited. */
export const obj = Object.create(base);
obj.own = 1;

/**
 * A class of the module's.
 */
class Greeter {
	/** Make one. */
	constructor() {
		this.own = 1;
	}
	/**
	 * A method.
	 * @returns {string} A greeting.
	 */
	hello() {
		return "hi";
	}
}

/** @type {Greeter} */
export const inst = new Greeter();
