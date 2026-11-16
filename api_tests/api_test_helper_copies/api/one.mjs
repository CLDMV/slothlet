/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/api/one.mjs
 *	@Date: 2026-11-12T00:24:01-08:00 (1794471841)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:24:01-08:00 (1794471841)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file importing the helper files `tally.mjs` and `tally.cjs`, which other api files load too.
 * @module api_test_helper_copies.one
 */
import { bump as tallyBump, read, queued } from "../helpers/tally.mjs";
import tallyCjs from "../helpers/tally.cjs";

/**
 * Count one up in the ES module helper this file imports.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.one.bump(); // 1
 */
export const bump = () => tallyBump();

/**
 * Count one up in the CommonJS helper this file imports.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.one.bumpCjs(); // 1
 */
export const bumpCjs = () => tallyCjs.bump();

/**
 * Hand out the ES module helper's function.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.one.give())(); // "SECRET"
 */
export const give = () => read;

/**
 * Hand out the ES module helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.one.box()).run(); // "SECRET"
 */
export const box = () => ({ run: read });

/**
 * Hand out the CommonJS helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.one.boxCjs()).run(); // "SECRET"
 */
export const boxCjs = () => ({ run: tallyCjs.read });

/**
 * Read the vault from the queue the ES module helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.one.viaQueue(); // "SECRET"
 */
export const viaQueue = () => queued();
