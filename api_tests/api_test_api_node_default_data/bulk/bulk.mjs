/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_data/bulk/bulk.mjs
 *	@Date: 2026-11-13T17:28:41-08:00 (1794619721)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T23:17:45-08:00 (1794640665)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Data with more object members than slothlet keeps per-path permission records for, so serializing it
 * under rules on its members runs past them.
 * @module api_test_api_node_default_data/bulk
 */

/**
 * 1,100 object members, `m0` to `m1099`, each holding its index as `v`.
 * @type {Record<string, {v: number}>}
 */
export const many = Object.fromEntries(Array.from({ length: 1100 }, (_, index) => [`m${index}`, { v: index }]));
