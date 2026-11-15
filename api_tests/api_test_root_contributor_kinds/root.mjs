/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_contributor_kinds/root.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The root's only file with a default-export function, with members of every kind beside it: functions,
 * an async function, a class, an object with functions, an instance of the class, an array, data values (a `Map`, a
 * `Date`, an error) and a primitive, and a `launch` routine.
 * @module api_test_root_contributor_kinds/root
 */

/**
 * Adds two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}

/**
 * Doubles a number after a tick.
 * @param {number} x - The number.
 * @returns {Promise<number>} Twice the number.
 */
export async function later(x) {
	await null;
	return x * 2;
}

/** A class with a getter and a static factory. */
export class Klass {
	/**
	 * @param {number} v - The value.
	 */
	constructor(v) {
		this.v = v;
	}

	/** @returns {number} Twice the value. */
	get double() {
		return this.v * 2;
	}

	/**
	 * @param {number} v - The value.
	 * @returns {Klass} A new instance.
	 */
	static make(v) {
		return new Klass(v);
	}
}

/** An object with a value, a function and a nested object. */
export const cfg = {
	n: 1,
	/** @returns {string} A marker. */
	f() {
		return "cfg.f";
	},
	nested: {
		/** @returns {string} A marker. */
		g() {
			return "g";
		}
	}
};

/** An instance of the class. */
export const inst = new Klass(5);

/** An array. */
export const arr = [1, 2];

/** A Map. */
export const map = new Map([["a", 1]]);

/** A Date. */
export const date = new Date(0);

/** An error. */
export const err = new Error("boom");

/** A primitive. */
export const num = 3;

/**
 * A `launch` routine: counts its runs on `globalThis.__rootKindsLaunches`.
 * @returns {string} A marker.
 */
export function launch() {
	globalThis.__rootKindsLaunches = (globalThis.__rootKindsLaunches ?? 0) + 1;
	return "launched";
}

/**
 * The root's own function.
 * @returns {string} A marker.
 */
export default function main() {
	return "main";
}
