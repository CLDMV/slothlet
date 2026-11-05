/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes/owner/owner.mjs
 *	@Date: 2026-11-05T06:08:55-08:00 (1793887735)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T08:16:33-08:00 (1793895393)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frozen and class members whose nodes, read through `self`, must answer as the plain values do (#667).
 * @module api_test_plain_js_nodes/owner
 */

import { self } from "@cldmv/slothlet/runtime";

/** A base class with a static method its derived class inherits. */
export class Base {
	/** @returns {string} Marker. */
	static kind() {
		return "base";
	}
}

/** A class extending {@link Base}. */
export class Sub extends Base {}

/** A class whose instance is exported. */
export class Foo {
	/** @returns {string} Marker. */
	hi() {
		return "foo";
	}
}

/** An instance of {@link Foo}. */
export const inst = new Foo();

/** A class answering `instanceof` with its own static `Symbol.hasInstance`. */
export class OwnCheck {
	/**
	 * @param {*} value - The value tested.
	 * @returns {boolean} Whether it carries the marker.
	 */
	static [Symbol.hasInstance](value) {
		return Boolean(value) && value.tag === "own";
	}
}

/** A class answering `instanceof` with a static `Symbol.hasInstance` it inherits. */
export class InheritedCheck extends OwnCheck {}

/** A frozen object holding a nested object. */
export const frozenBox = Object.freeze({ a: 1, inner: { b: 2 } });

/** A frozen array holding a frozen object. */
export const frozenList = Object.freeze([Object.freeze({ deep: 1 })]);

/** An object no module freezes. */
export const open = { o: 1 };

/** An object this module freezes through `self`. */
export const later = { q: 1 };

/**
 * Run `step`, answering what it returned or how it threw.
 * @param {Function} step - The step.
 * @returns {*} Its result, or `"threw <name>"`.
 */
function attempt(step) {
	try {
		return step();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Add a property to this module's deep-frozen element through `self`.
 * @returns {string} The outcome.
 */
export function writeDeepFrozen() {
	return {
		add: attempt(() => {
			self.owner.frozenList[0].added = 1;
			return "added";
		}),
		write: attempt(() => {
			self.owner.frozenBox.a = 2;
			return "written";
		}),
		value: self.owner.frozenBox.a
	};
}

/**
 * Freeze this module's own objects through `self`.
 * @returns {boolean[]} Whether each is frozen afterwards.
 */
export function freezeOwn() {
	Object.freeze(self.owner.later);
	return [Object.isFrozen(self.owner.later), Object.isFrozen(self.owner.frozenBox)];
}

/**
 * Read this module's own frozen and class members through `self`.
 * @returns {object} What each read answered.
 */
export function readOwn() {
	return {
		isFrozen: attempt(() => Object.isFrozen(self.owner.frozenBox)),
		subPrototype: attempt(() => Object.getPrototypeOf(self.owner.Sub) === self.owner.Base)
	};
}
