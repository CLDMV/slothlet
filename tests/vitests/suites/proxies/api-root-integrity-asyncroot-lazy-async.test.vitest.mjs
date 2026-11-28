/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/api-root-integrity-asyncroot-lazy-async.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:52-08:00 (1795869172)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's integrity (defining, deleting, assigning, closing and setting its prototype) for the
 * `asyncroot` root in lazy mode under the async runtime, both attributions.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/api-root-integrity.mjs`.
 * @module tests/vitests/suites/proxies/api-root-integrity-asyncroot-lazy-async
 */

import { describeApiRootIntegrity } from "../../setup/api-root-integrity.mjs";

describeApiRootIntegrity({ roots: ["asyncroot"], modes: ["lazy"], runtimes: ["async"] });
