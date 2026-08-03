/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_underscore/clash/clash.mjs
 *	@Date: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A module that exports FRAMEWORK-RESERVED names. `_materialize` is the function lazy
 * mode drives materialization through, so a module must never be able to displace it; `__impl` is
 * private wrapper state. Freeing ordinary underscore exports must not free these.
 * @module api_test_underscore.clash
 * @memberof module:api_test_underscore
 */

/** @type {string} Reserved: collides with the lazy-mode materialization entry point. */
export const _materialize = "HIJACKED";

/** @type {string} Reserved: collides with private wrapper state. */
export const __impl = "HIJACKED";

/** @type {string} Ordinary member, present so the module composes normally. */
export const safe = "safe";
