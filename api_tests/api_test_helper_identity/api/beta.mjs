/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_identity/api/beta.mjs
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
 * @fileoverview A second api file importing the helper file `shared.mjs`, which `alpha.mjs` imports too.
 * @module api_test_helper_identity.beta
 */
import { read, readLater, queued } from "../helpers/shared.mjs";

/**
 * Hand out the shared helper's function.
 * @returns {Function} The helper's `read`.
 * @example
 * (await api.beta.give())(); // "SECRET"
 */
export const give = () => read;

/**
 * Hand out the shared helper's async function.
 * @returns {Function} The helper's `readLater`.
 * @example
 * await (await api.beta.giveLater())(); // "SECRET"
 */
export const giveLater = () => readLater;

/**
 * Hand out the shared helper's function inside plain data.
 * @returns {{run: Function}} The helper's `read`, boxed.
 * @example
 * (await api.beta.box()).run(); // "SECRET"
 */
export const box = () => ({ run: read });

/**
 * Read the vault from the queue the shared helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.beta.viaQueue(); // "SECRET"
 */
export const viaQueue = () => queued();
