/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-fast-package-frame-lazy-live-fast.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:26-08:00 (1795869146)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package's code between a module's code and the node it calls is attributed alike under both values of `permissions.attribution`: lazy mode, the live runtime, `attribution: "fast"`.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/permissions-fast-package-frame.mjs`.
 * @module tests/vitests/suites/permissions/permissions-fast-package-frame-lazy-live-fast
 */

import { describeFastPackageFrame } from "../../setup/permissions-fast-package-frame.mjs";

describeFastPackageFrame({ modes: ["lazy"], runtimes: ["live"], attributions: ["fast"] });
