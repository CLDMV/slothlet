/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_prototype_holders_lib/classes.mjs
 *	@Date: 2026-11-19T04:53:11-08:00 (1795092791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:16-08:00 (1795868956)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Classes the owner exports and the reader imports itself, so each can compare what `self` hands it with
 * the class it holds.
 * @module api_test_prototype_holders_lib/classes
 */
import { EventEmitter } from "node:events";

/** A plain class. */
export class Box {
	/** @returns {string} Marker. */
	label() {
		return "box";
	}
}

/** A module-private member of the prototype. */
Box.prototype._secret = 1;

/** An emitter class. */
export class Bus extends EventEmitter {
	/** @returns {string} Marker. */
	ping() {
		return "bus";
	}
}

/** A class the owner exports under two names. */
export class Foo {
	/** @returns {string} Marker. */
	hi() {
		return "foo";
	}
}

/**
 * Run a step and say how it went.
 * @param {function(): *} step - The step.
 * @returns {*} Its result, or `"threw <code>"`.
 */
export function attempt(step) {
	try {
		return step();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}
