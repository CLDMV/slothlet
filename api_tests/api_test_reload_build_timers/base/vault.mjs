/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reload_build_timers/base/vault.mjs
 *	@Date: 2026-11-21T12:54:54-08:00 (1795294494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:20-08:00 (1795868960)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a host-owned node a guest module is denied, read and written while a reload builds.
 * @module api_test_reload_build_timers.vault
 */

/** A value the guest is denied by rule. */
export const secret = "SECRET";

/** A value the guest does not own and may not write. */
export const open = "open";
