/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes/owner/owner.mjs
 *	@Date: 2026-11-05T06:08:55-08:00 (1793887735)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T00:05:57-08:00 (1794038757)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frozen and class members whose nodes, read through `self`, must answer as the plain values do (#667).
 * @module api_test_plain_js_nodes/owner
 */

import { self } from "@cldmv/slothlet/runtime";
import { ownerWrites, freezeLater, reads } from "../../api_test_plain_js_nodes_lib/cases.mjs";

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

/** A class this module keeps to itself: only its instance is exported. */
class Hidden {
	/** @returns {string} Marker. */
	hi() {
		return "hidden";
	}
}

/** An instance of {@link Hidden}. */
export const hiddenInst = new Hidden();

/** How many times the `constructor` accessor of {@link Accessed}'s prototype ran. */
let constructorReads = 0;

/** A class whose prototype answers `constructor` through an accessor of this module's. */
class Accessed {
	/** @returns {string} Marker. */
	hi() {
		return "accessed";
	}
}
Object.defineProperty(Accessed.prototype, "constructor", {
	configurable: true,
	get() {
		constructorReads++;
		return Accessed;
	}
});

/** An instance of {@link Accessed}. */
export const accessedInst = new Accessed();

/**
 * @returns {number} How many times the `constructor` accessor of {@link Accessed}'s prototype ran.
 */
export function constructorReadCount() {
	return constructorReads;
}

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

/** An open object holding an object. */
export const shelf = { item: { n: 1 } };

/** An object no module freezes. */
export const open = { o: 1 };

/** An object whose getter reads a sibling member through `this`. */
export const withGetter = {
	_v: 5,
	/** @returns {number} The sibling's value. */
	get v() {
		return this._v;
	}
};

/** An object this module freezes through `self`. */
export const later = { q: 1 };

/**
 * This module's own writes, through `self`, to members it froze when it loaded.
 * @returns {object} The outcome of each.
 */
export function writeOwnFrozen() {
	return ownerWrites(self.owner);
}

/**
 * Freeze `later` through `self`.
 * @returns {boolean} Whether it is frozen afterwards.
 */
export function freezeOwn() {
	return freezeLater(self.owner);
}

/**
 * The reads, made by this module on its own members through `self`.
 * @returns {object} What each answered.
 */
export function readOwn() {
	return reads(self.owner);
}
