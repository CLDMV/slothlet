/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/helpers/slow.mjs
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
 * @fileoverview A helper file that waits at its top level before it is ready.
 * @module api_test_load_flow.helpers.slow
 */
await new Promise((resolve) => setTimeout(resolve, 30));

/**
 * Whether the file has finished loading.
 * @type {boolean}
 */
export const ready = true;
