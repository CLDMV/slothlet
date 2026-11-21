/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_require/api/five.mjs
 *	@Date: 2026-11-13T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file requiring the CommonJS helper `plain.cjs` through a `require` made from its own plain path,
 * as another api file of this folder does.
 * @module api_test_plain_require.five
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** A `require` made from this file's path, without the query slothlet loads it with. */
const require = createRequire(fileURLToPath(import.meta.url));
const plain = require("../helpers/plain.cjs");

/**
 * Count one up in the helper.
 * @returns {number} The count so far.
 * @example
 * api.five.bump(); // 1
 */
export const bump = () => plain.bump();

/**
 * Read the vault through the helper, inside this file's call.
 * @returns {string} What the helper read.
 * @example
 * api.five.read(); // "SECRET"
 */
export const read = () => plain.read();

/**
 * Where the `require` this file made finds the helper.
 * @returns {string} The helper's path.
 * @example
 * api.five.where(); // "/…/helpers/plain.cjs"
 */
export const where = () => require.resolve("../helpers/plain.cjs");
