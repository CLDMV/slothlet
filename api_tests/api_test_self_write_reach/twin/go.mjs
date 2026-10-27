/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/twin/go.mjs
 *	@Date: 2026-10-18T19:48:21-07:00 (1792378101)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:51:09-07:00 (1792378269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "twin" by the write-grant tests (#625). With `peer` it is a second api path of one module
// importing the file `go` resumes in, so the live runtime cannot tell which of the two is running there.
import { later } from "./resume.mjs";

/**
 * Hand the work to the shared file, so this file's frame is gone when it resumes.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} What the shared file reports.
 */
export function go(gate) {
	return later(gate);
}
