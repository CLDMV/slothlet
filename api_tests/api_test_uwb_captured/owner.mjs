/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_captured/owner.mjs
 *	@Date: 2026-11-25T01:47:11-08:00 (1795600031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:07:59-08:00 (1795601279)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values another module reads through `self`.
 */

/**
 * An arrow function: no constructor.
 * @returns {number} One.
 */
export const arrow = () => 1;

/** An object with an accessor and data. */
export const conf = {
	get g() {
		return 1;
	},
	set g(value) {
		this.v = value;
	},
	v: 2
};

/** A class with a method. */
export class Shape {
	/** @returns {string} A label. */
	area() {
		return "area";
	}
}

/** An object serializing through its own `toJSON`, into data holding a function and an object with a `toJSON`. */
export const cfg = {
	toJSON() {
		return {
			pub: 1,
			run() {
				return "run";
			},
			inner: {
				toJSON() {
					return { x: 1 };
				}
			},
			nested: { deep: { y: 2 } }
		};
	}
};

/**
 * An async generator function.
 * @yields {number} One.
 */
export async function* agen() {
	yield 1;
}

/**
 * A generator function.
 * @yields {number} Two.
 */
export function* gen() {
	yield 2;
}

/**
 * An async function.
 * @returns {Promise<number>} Three.
 */
export async function later() {
	return 3;
}
