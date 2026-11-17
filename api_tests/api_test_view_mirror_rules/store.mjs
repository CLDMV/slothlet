/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_view_mirror_rules/store.mjs
 *	@Date: 2026-11-16T00:29:25-08:00 (1794817765)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:26:58-08:00 (1794882418)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module holding an open object, and objects and arrays closed to extension, sealed and
 * frozen, each with a value member and an object member.
 * @module api_test_view_mirror_rules.store
 * @memberof module:api_test_view_mirror_rules
 */

/**
 * The object each export holds.
 * @returns {{x: number, hid: string, obj: {k: number}}} A new one.
 */
const make = () => ({ x: 1, hid: "S3CRET", obj: { k: 1 } });

/** @type {object} Closed to extension. */
export const closed = Object.preventExtensions(make());

/** @type {object} Sealed. */
export const sealed = Object.seal(make());

/** @type {Readonly<object>} Frozen, holding a frozen object. */
export const frozen = Object.freeze({ x: 1, hid: "S3CRET", obj: Object.freeze({ k: 1 }) });

/** @type {Array<*>} An array closed to extension. */
export const closedArr = Object.preventExtensions(["S3CRET", { k: 1 }, 3]);

/** @type {Array<*>} A sealed array. */
export const sealedArr = Object.seal(["S3CRET", { k: 1 }, 3]);

/** @type {ReadonlyArray<*>} A frozen array, holding a frozen object. */
export const frozenArr = Object.freeze(["S3CRET", Object.freeze({ k: 1 }), 3]);

/** An object open to extension. */
export const open = make();
