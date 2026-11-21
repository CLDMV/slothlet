/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shutdown_left_work/base/vault.mjs
 *	@Date: 2026-11-21T14:50:54-08:00 (1795301454)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T14:59:37-08:00 (1795301977)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a host-owned node with members a guest module is denied by rule, and members it may use.
 * @module api_test_shutdown_left_work.vault
 */

/** A value the guest is denied by rule. */
export const secret = "SECRET";

/** A value the guest may read. */
export const open = "open";

/** An object whose member the guest is denied by rule. */
export const box = { inner: "INNER" };

/**
 * A function the guest is denied by rule.
 * @returns {string} "HIDDEN".
 */
export function hidden() {
	return "HIDDEN";
}

/**
 * A function the guest may call.
 * @returns {string} "SHOWN".
 */
export function shown() {
	return "SHOWN";
}
