/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/api/late.mjs
 *	@Date: 2026-11-12T22:53:16-08:00 (1794552796)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:53:16-08:00 (1794552796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file importing `helpers/queue.mjs`, which waits on a file `early.mjs` started loading.
 * @module api_test_load_flow.late
 */
import { queued } from "../helpers/queue.mjs";

/**
 * Read the vault from the queue the helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or an error code.
 * @example
 * await api.late.viaHelper(); // "SECRET"
 */
export const viaHelper = () => queued();
