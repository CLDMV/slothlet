/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_capture/store.mjs
 *	@Date: 2026-10-24T15:16:48-07:00 (1792880208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T15:17:10-07:00 (1792880230)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Scratch fixture (#656 review): a module holding frozen, sealed and mutable arrays and objects.
 */

/** @type {ReadonlyArray<number>} */
export const prims = Object.freeze([1, 2, 3]);

/** @type {ReadonlyArray<object>} */
export const objs = Object.freeze([{ a: 1 }, { b: 2 }]);

/** @type {ReadonlyArray<ReadonlyArray<*>>} */
export const nested = Object.freeze([Object.freeze([1, 2]), Object.freeze([{ c: 3 }])]);

/** @type {ReadonlyArray<*>} A frozen array holding a function and an object holding a function. */
export const fns = Object.freeze([() => "F0", Object.freeze({ run: () => "RUN", note: "NOTE" }), { run: () => "RUN2", note: "NOTE2" }]);

/** @type {Array<*>} The same shape, not frozen. */
export const mfns = [() => "F0", { run: () => "RUN", note: "NOTE" }, { run: () => "RUN2", note: "NOTE2" }];

/** @type {Array<object>} A sealed, not frozen, array. */
export const sealed = Object.seal([{ s: 1 }, { s: 2 }]);

/** @type {Array<object>} An array the test freezes after a first read. */
export const later = [{ l: 1 }, () => "LATER"];

/** @type {ReadonlyArray<object>} A frozen array holding a frozen object. */
export const deep = Object.freeze([Object.freeze({ a: "DEEP" }), { a: "SOFT" }]);

/** @type {Readonly<object>} A frozen object export with object and function members. */
export const ns = Object.freeze({
	inner: { x: 1 },
	frozenInner: Object.freeze({ y: 2 }),
	fn: () => "NSFN",
	list: Object.freeze([{ z: 3 }])
});
