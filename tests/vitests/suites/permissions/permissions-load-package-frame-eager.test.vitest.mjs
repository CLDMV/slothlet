/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-load-package-frame-eager.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:33-08:00 (1795869153)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package's or a host file's code between the code a file's load started and the node it calls is attributed as it is inside a call: eager mode, both runtimes and attributions.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/permissions-load-package-frame.mjs`.
 * @module tests/vitests/suites/permissions/permissions-load-package-frame-eager
 */

import { describeLoadPackageFrame } from "../../setup/permissions-load-package-frame.mjs";

describeLoadPackageFrame({ modes: ["eager"] });
