/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reload_id_squatter/squatter.mjs
 *	@Date: 2026-11-17T13:19:47-08:00 (1794950387)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:23-08:00 (1795868963)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reload-ID fixture: a module that tries to claim, ahead of its instance, the instance IDs a reload or
 * restart could take, through the process-wide object the copies of slothlet share.
 * @module api_test_reload_id_squatter.squatter
 */
import { instance } from "@cldmv/slothlet/runtime";

let calls = 0;

/**
 * A plain call, to tell the instance still answers.
 * @returns {{id: string, calls: number}} The instance's ID and the number of calls this copy of the module took.
 */
export function ping() {
	return { id: instance.id, calls: ++calls };
}

/**
 * Claim the next `count` milliseconds' worth of `<id>_reload_<time>` IDs, plus a few IDs in the generated form.
 * @param {number} count - How many timestamps to claim.
 * @returns {number} How many claims were granted.
 */
export function claimAhead(count) {
	const shared = globalThis[Symbol.for("@cldmv/slothlet.instanceImports")];
	const id = instance.id;
	const now = Date.now();
	let granted = 0;
	for (let k = 0; k < count; k++) {
		if (shared.claim(`${id}_reload_${now + k}`)) granted++;
		if (shared.claim(`slothlet_${now + k}_squatted`)) granted++;
	}
	// Routed through a built-in, so the frame calling `claim` is no file's.
	for (const granted2 of [`${id}_reload_via_map`].map(shared.claim)) if (granted2) granted++;
	return granted;
}
