/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_require_helper/inside/alpha.mjs
 *	@Date: 2026-11-12T23:03:11-08:00 (1794553391)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:03:11-08:00 (1794553391)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file that loads a CommonJS helper with `createRequire`, keeps a node of the store, and has the
 * helper read it.
 * @module api_test_require_helper.inside.alpha
 */
import { self } from "@cldmv/slothlet/runtime";
import { createRequire } from "node:module";

const helper = createRequire(import.meta.url)("./survey.cjs");
const kept = {};

/**
 * Keep a node of the store.
 * @param {string} name - The store's member.
 * @returns {string} The kept value's type.
 * @example
 * await api.alpha.keep("sealed"); // "object"
 */
export const keep = (name) => {
	kept[name] = self.store[name];
	return typeof kept[name];
};

/**
 * Have the helper read the node kept under a name.
 * @param {string} name - The store's member.
 * @returns {{hid: *, k: *, kDesc: *}} What each of the helper's reads gave.
 * @example
 * await api.alpha.look("sealed"); // { hid: "S3CRET", k: 1, kDesc: 1 }
 */
export const look = (name) => helper.survey(kept[name]);

/**
 * Count one up in the helper.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.alpha.bump(); // 1
 */
export const bump = () => helper.bump();
