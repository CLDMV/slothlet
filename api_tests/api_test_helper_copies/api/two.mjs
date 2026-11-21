/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/api/two.mjs
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
 * @module api_test_helper_copies.two
 */
import { bump as tallyBump, read, queued } from "../helpers/tally.mjs";
import tallyCjs from "../helpers/tally.cjs";
import { fileURLToPath } from "node:url";

/**
 * Count one up in the ES module helper this file imports.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.two.bump(); // 1
 */
export const bump = () => tallyBump();

/**
 * Count one up in the CommonJS helper this file imports.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.two.bumpCjs(); // 1
 */
export const bumpCjs = () => tallyCjs.bump();

/**
 * Hand out the ES module helper's function.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.two.give())(); // "SECRET"
 */
export const give = () => read;

/**
 * Hand out the ES module helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.two.box()).run(); // "SECRET"
 */
export const box = () => ({ run: read });

/**
 * Hand out the CommonJS helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.two.boxCjs()).run(); // "SECRET"
 */
export const boxCjs = () => ({ run: tallyCjs.read });

/**
 * Read the vault from the queue the ES module helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.two.viaQueue(); // "SECRET"
 */
export const viaQueue = () => queued();

/**
 * Load a helper file only this file loads under a URL that names `one.mjs` as the api file it is loaded for, and hand
 * its function out inside plain data.
 * @returns {Promise<{run: Function}>} The helper's `read`, boxed.
 * @example
 * (await api.two.mislabelled()).run(); // "SECRET"
 */
export const mislabelled = async () => {
	const own = new URL(import.meta.url);
	const target = new URL("../helpers/private.mjs", own);
	target.searchParams.set("slothlet_instance", own.searchParams.get("slothlet_instance"));
	target.searchParams.set("slothlet_helpers", "module");
	target.searchParams.set("slothlet_for", fileURLToPath(new URL("./one.mjs", own)).replace(/\\/g, "/"));
	const mount = own.searchParams.get("module");
	if (mount) target.searchParams.set("slothlet_mount", mount);
	const copy = await import(target.href);
	return { run: copy.read };
};
