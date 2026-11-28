/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_write_reach_twin/api/plant.mjs
 *	@Date: 2026-10-26T07:53:35-07:00 (1793026415)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:48-08:00 (1795868988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// A third api path of the `twin` module that resumes in the file `twin.peer` imports too (#625).
import { plantLater } from "../lib/resume.mjs";

/**
 * Place a function through the api this module is handed, from the shared file, once the gate opens.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} What {@link plantLater} reports.
 * @example
 * await plant(gate); // "LOOSE_SET_UNATTRIBUTED" while twin.peer is suspended too
 */
export function plant(gate) {
	return plantLater(gate);
}
