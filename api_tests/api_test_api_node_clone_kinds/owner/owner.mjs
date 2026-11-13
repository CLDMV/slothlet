/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_clone_kinds/owner/owner.mjs
 *	@Date: 2026-11-13T10:00:00-08:00 (1794592800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T10:00:00-08:00 (1794592800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose built-in data objects (dates, maps, sets, errors, patterns, buffers, boxed primitives)
 * other modules read through the api and clone.
 * @module api_test_api_node_clone_kinds/owner
 */

/** An item class, held in the map. */
class Item {
	/**
	 * @param {number} n - A number.
	 */
	constructor(n) {
		this.n = n;
	}
}

/**
 * A date.
 * @type {Date}
 */
export const when = new Date(5);

/**
 * A map holding a plain object, a class instance and a date.
 * @type {Map<*, *>}
 */
export const byName = new Map([
	["one", { n: 1 }],
	["item", new Item(2)],
	[3, new Date(3)]
]);

/**
 * A set of strings and an object.
 * @type {Set<*>}
 */
export const tags = new Set(["a", "b", { deep: [1, 2] }]);

/**
 * An error with a cause.
 * @type {RangeError}
 */
export const failure = new RangeError("out of range", { cause: { code: 7, list: [1] } });

/**
 * An error with no message, of a class of the module's own.
 * @type {Error}
 */
export const bare = new (class Oops extends Error {})();

/**
 * A pattern with flags and a moved `lastIndex`.
 * @type {RegExp}
 */
export const pattern = /x+/gi;
pattern.lastIndex = 2;

/**
 * Bytes over part of a larger buffer.
 * @type {Uint8Array}
 */
export const bytes = new Uint8Array(new ArrayBuffer(8), 2, 4).fill(9);

/** The buffer `pair`'s two views share. */
const shared = new ArrayBuffer(4);

/**
 * Two views sharing one buffer.
 * @type {{small: Uint8Array, wide: Uint16Array}}
 */
export const pair = { small: new Uint8Array(shared), wide: new Uint16Array(shared) };

/**
 * A DataView.
 * @type {DataView}
 */
export const view = new DataView(new ArrayBuffer(4), 1, 2);

/**
 * A buffer.
 * @type {ArrayBuffer}
 */
export const buffer = new Uint8Array([1, 2, 3]).buffer;

/**
 * A resizable buffer.
 * @type {ArrayBuffer}
 */
export const growable = new ArrayBuffer(2, { maxByteLength: 8 });

/**
 * A boxed string.
 * @type {String}
 */
export const boxedString = new String("hi");

/**
 * A boxed number.
 * @type {Number}
 */
export const boxedNumber = new Number(4);

/**
 * A boxed boolean.
 * @type {Boolean}
 */
export const boxedBoolean = new Boolean(false);

/**
 * A weak map, which the platform refuses to clone.
 * @type {WeakMap<object, *>}
 */
export const weak = new WeakMap();

/**
 * An object holding each kind.
 * @type {object}
 */
export const kinds = {
	when: new Date(0),
	byName: new Map([[1, { n: 2 }]]),
	failure: new TypeError("t"),
	pattern: /y/m,
	bytes: new Uint8Array([4, 5])
};

/**
 * The owner's own date's time value, as the owner reads it.
 * @returns {number} `when.getTime()`.
 */
export const time = () => when.getTime();

/**
 * The owner's own map's object, as the owner reads it.
 * @returns {number} `byName.get("one").n`.
 */
export const one = () => byName.get("one").n;

/**
 * Memory that can be shared.
 * @type {SharedArrayBuffer}
 */
export const sharedMemory = new SharedArrayBuffer(4);

/**
 * Bytes over memory that can be shared.
 * @type {Uint8Array}
 */
export const sharedBytes = new Uint8Array(new SharedArrayBuffer(2));
