/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-fast-package-frame-eager.test.vitest.mjs
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
 * @fileoverview A package's code between a module's code and the node it calls is attributed alike under both values of `permissions.attribution`: eager mode, both runtimes and attributions.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/permissions-fast-package-frame.mjs`.
 * @module tests/vitests/suites/permissions/permissions-fast-package-frame-eager
 */

import { describeFastPackageFrame } from "../../setup/permissions-fast-package-frame.mjs";

describeFastPackageFrame({ modes: ["eager"] });
