/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/check-call-caller.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:57 -07:00 (1791082977)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempt the host-only `permissions.global.checkCall` from a MODULE context (#508), so a test can
 * assert a module caller is REFUSED rather than answered — and, when the host has granted it, that
 * the answer comes through. Returns the outcome instead of throwing.
 * @param {string} callerPath - Identity to ask about.
 * @param {string} targetPath - Target api path.
 * @param {Array<*>} [args] - Arguments of the call being asked about.
 * @returns {Promise<{ ok: boolean, allowed?: boolean, code?: string }>} `ok:true` + the decision when
 *   permitted; otherwise `ok:false` + the error code.
 */
export async function attempt(callerPath, targetPath, args) {
	try {
		return { ok: true, allowed: await self.slothlet.permissions.global.checkCall(callerPath, targetPath, args) };
	} catch (error) {
		return { ok: false, code: error.code || error.name };
	}
}

/**
 * The gatable sibling, for contrast: `global.checkAccess` carries no built-in deny, so under an
 * allow default a module reaches it. Returns the outcome instead of throwing.
 * @param {string} callerPath - Identity to ask about.
 * @param {string} targetPath - Target api path.
 * @returns {Promise<{ ok: boolean, allowed?: boolean, code?: string }>} `ok:true` + the decision when
 *   permitted; otherwise `ok:false` + the error code.
 */
export async function attemptAccess(callerPath, targetPath) {
	try {
		return { ok: true, allowed: await self.slothlet.permissions.global.checkAccess(callerPath, targetPath) };
	} catch (error) {
		return { ok: false, code: error.code || error.name };
	}
}
