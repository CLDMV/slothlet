/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-root-integrity-objroot-lazy-live.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's integrity (defining, deleting, assigning, closing and setting its prototype) for the
 * `objroot` root in lazy mode under the live runtime, both attributions.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/api-root-integrity.mjs`.
 * @module tests/vitests/suites/proxies/api-root-integrity-objroot-lazy-live
 */

import { describeApiRootIntegrity } from "../../setup/api-root-integrity.mjs";

describeApiRootIntegrity({ roots: ["objroot"], modes: ["lazy"], runtimes: ["live"] });
