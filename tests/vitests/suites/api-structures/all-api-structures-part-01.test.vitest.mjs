/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/api-structures/all-api-structures-part-01.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:14-08:00 (1795869074)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview API structures, lazy against eager, for part 1 of 6 of the api_tests folders.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/all-api-structures.mjs`; this file runs its part of the sorted
 * fixture folders (a contiguous slice), under the matrix pairs it keeps.
 * @module tests/vitests/suites/api-structures/all-api-structures-part-01
 */

import { describeApiStructures } from "../../setup/all-api-structures.mjs";

describeApiStructures(1);
