/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_shutdown_kept_handles/base/vault.mjs
 *	@Date: 2026-11-21T22:02:45-08:00 (1795327365)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:50-08:00 (1795868990)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a host-owned node exporting a class, and a value.
 * @module api_test_shutdown_kept_handles.vault
 */

/** A class a guest module reads through `self`. */
export class Thing {
	/**
	 * @param {string} v - The value it holds.
	 */
	constructor(v) {
		this.v = v;
	}

	/**
	 * @returns {string} The value it holds.
	 */
	read() {
		return this.v;
	}
}

/** A value the guest may read. */
export const open = "open";
