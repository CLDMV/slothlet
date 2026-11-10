/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check_crossings/owner/owner.mjs
 *	@Date: 2026-11-09T20:57:15-08:00 (1794286635)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T21:04:36-08:00 (1794287076)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose class prototype and emitter reach another module, for `api.slothlet.wrapped` (#671):
 * by a read through `self`, as a member of plain data handed as an argument, and as an emitter's prototype.
 * @module api_test_wrapped_check_crossings/owner
 */
import { EventEmitter } from "node:events";
import { self } from "@cldmv/slothlet/runtime";

/** A class of this module's. */
export class Foo {
	/** @returns {string} Marker. */
	hi() {
		return "foo";
	}
}

/** An emitter class of this module's, kept to itself. */
class Bus extends EventEmitter {
	/** @returns {string} Marker. */
	ping() {
		return "bus";
	}
}

/** An instance of {@link Bus}. */
export const bus = new Bus();

/**
 * A plain function, whose node answers its own `valueOf`.
 * @returns {number} One.
 */
export function fn() {
	return 1;
}

/**
 * Hand the reader plain data holding {@link Foo}'s prototype.
 * @returns {object} What the reader answered.
 */
export function giveNested() {
	return self.reader.inspect({ inner: { p: Foo.prototype } });
}

/**
 * Hand the reader frozen plain data holding {@link Foo}'s prototype.
 * @returns {object} What the reader answered.
 */
export function giveFrozen() {
	return self.reader.inspect(Object.freeze({ inner: Object.freeze({ p: Foo.prototype }) }));
}

/**
 * Hand the reader plain data holding nothing of this module's code.
 * @returns {object} What the reader answered.
 */
export function givePlain() {
	return self.reader.inspect({ inner: { n: 1 } });
}
