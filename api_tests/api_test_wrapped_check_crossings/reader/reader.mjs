/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check_crossings/reader/reader.mjs
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
 * @fileoverview A module that asks `self.slothlet.wrapped` about what it is handed of another module's (#671).
 * @module api_test_wrapped_check_crossings/reader
 */
import { types } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * What a box handed as an argument, and its member, are.
 * @param {object} box - The box.
 * @returns {{ proxy: boolean, frozen: boolean, box: boolean, inner: boolean }} The answers.
 */
export function inspect(box) {
	return {
		proxy: types.isProxy(box),
		frozen: Object.isFrozen(box),
		box: self.slothlet.wrapped(box),
		inner: self.slothlet.wrapped(box.inner)
	};
}

/**
 * Whether the owner's class prototype, and a method on it, read through `self`, are slothlet's wrappers.
 * @returns {{ prototype: boolean, method: boolean }} The answers.
 */
export function checkPrototype() {
	const prototype = self.owner.Foo.prototype;
	return { prototype: self.slothlet.wrapped(prototype), method: self.slothlet.wrapped(prototype.hi) };
}

/**
 * What the owner's emitter reports as its prototype, and whether that is one of slothlet's wrappers.
 * @returns {{ proxy: boolean, wrapped: boolean }} The answers.
 */
export function checkEmitterPrototype() {
	const prototype = Object.getPrototypeOf(self.owner.bus);
	return { proxy: types.isProxy(prototype), wrapped: self.slothlet.wrapped(prototype) };
}
