/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/secrets.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T22:41:33-07:00 (1791870093)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#609): a namespace with a plain member and an array member that the rules deny another module.
 * @module api_test_frozen_permissions.secrets
 */

/** @type {string} A member a denied caller must not read. */
export const key = "SECRET";

/** @type {string[]} An array member whose elements a denied caller must not read. */
export const list = ["a", "b"];

/** @type {string[]} An array member with functions of its own that hand back its elements. */
export const labels = ["x", "y"];
labels.toJSON = () => labels[0];
labels.reveal = () => labels[1];
labels[Symbol.for("slothlet.test.peek")] = () => labels[0];

/** @type {{v: string}} One object held at two positions, readable at the first and not the second. */
const item = { v: "SHARED" };

/** @type {object[]} An array member holding the same object twice. */
export const shared = [item, item];

/** @type {{first: object, second: object}} A plain member holding the same object under two keys. */
export const pair = { first: item, second: item };

/** @type {string[]} An array member with an element `Object.keys()` does not list, which `JSON.stringify` still writes. */
export const hidden = ["shown"];
Object.defineProperty(hidden, 1, { value: "HIDDEN", enumerable: false, writable: true, configurable: true });
