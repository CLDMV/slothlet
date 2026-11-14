/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_identity/api/alpha.mjs
 *	@Date: 2026-11-11T23:40:32-08:00 (1794469232)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:53:11-08:00 (1794469991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file importing two helper files: `shared.mjs`, which `beta.mjs` imports too, and `solo.mjs`,
 * which only this file imports. Its leaves hand the helpers' own functions out.
 * @module api_test_helper_identity.alpha
 */
import { self } from "@cldmv/slothlet/runtime";
import { read, readLater, queued, push } from "../helpers/shared.mjs";
import { read as soloRead, readLater as soloReadLater, queued as soloQueued, push as soloPush } from "../helpers/solo.mjs";

const settle = (resolve, fn) => () => {
	try {
		resolve(fn());
	} catch (error) {
		resolve(error?.code ?? String(error?.message ?? error));
	}
};

// A function written in this file, outside every export.
const local = () => String(self.vault.get());

/**
 * Hand out a function written at the top of this file.
 * @returns {Function} This file's `local`.
 * @example
 * (await api.alpha.giveLocal())(); // "SECRET"
 */
export const giveLocal = () => local;

/**
 * Hand out the same function written at the top of this file from another leaf.
 * @returns {Function} This file's `local`.
 * @example
 * (await api.alpha.giveLocalAgain())(); // "SECRET"
 */
export const giveLocalAgain = () => local;

/**
 * Hand out the shared helper's function.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.alpha.give())(); // "SECRET"
 */
export const give = () => read;

/**
 * Hand out the same function of the shared helper from another leaf of this file.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.alpha.again())(); // "SECRET"
 */
export const again = () => read;

/**
 * Hand out the shared helper's async function.
 * @returns {Function} The helper's `readLater`.
 * @example
 * await (await api.alpha.giveLater())(); // "SECRET"
 */
export const giveLater = () => readLater;

/**
 * Hand out the shared helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.alpha.box()).run(); // "SECRET"
 */
export const box = () => ({ run: read });

/**
 * Hand out the function of the helper only this file imports.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.alpha.giveSolo())(); // "SECRET"
 */
export const giveSolo = () => soloRead;

/**
 * Hand out the async function of the helper only this file imports.
 * @returns {Function} The helper's `readLater`.
 * @example
 * await (await api.alpha.giveSoloLater())(); // "SECRET"
 */
export const giveSoloLater = () => soloReadLater;

/**
 * Hand out, inside plain data, the function of the helper only this file imports.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.alpha.boxSolo()).run(); // "SECRET"
 */
export const boxSolo = () => ({ run: soloRead });

/**
 * Call the shared helper's function from this leaf's own code.
 * @returns {string} What the vault holds.
 * @example
 * await api.alpha.own(); // "SECRET"
 */
export const own = () => read();

/**
 * Read the vault from the queue the shared helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.alpha.viaQueue(); // "SECRET"
 */
export const viaQueue = () => queued();

/**
 * Read the vault from the queue the helper only this file imports started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.alpha.viaSoloQueue(); // "SECRET"
 */
export const viaSoloQueue = () => soloQueued();

/**
 * Read the vault with a closure of this leaf's, run from the queue the shared helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.alpha.viaQueueOwn(); // "SECRET"
 */
export const viaQueueOwn = () => new Promise((resolve) => push(settle(resolve, () => self.vault.get())));

/**
 * Read the vault with a closure of this leaf's, run from the queue the helper only this file imports started when it
 * loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.alpha.viaSoloQueueOwn(); // "SECRET"
 */
export const viaSoloQueueOwn = () => new Promise((resolve) => soloPush(settle(resolve, () => self.vault.get())));
