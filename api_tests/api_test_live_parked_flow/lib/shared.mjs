/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_parked_flow/lib/shared.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T08:00:00-08:00 (1794672000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file only `alpha` imports: an async function that reads the vault once the gate the host set
 * opens.
 * @module api_test_live_parked_flow.lib.shared
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault once `globalThis.__parkedFlowGate` settles.
 * @returns {Promise<string>} What the vault answered.
 * @example
 * await readLater(); // "SECRET"
 */
export const readLater = async () => {
	await globalThis.__parkedFlowGate;
	return self.vault.get();
};
