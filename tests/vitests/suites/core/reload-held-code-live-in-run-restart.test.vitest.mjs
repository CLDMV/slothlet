/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-held-code-live-in-run-restart.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:38-08:00 (1795869098)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code made before a `reload()` / `restart()` and run after it acts on the rebuilt instance, with the
 * context it would have had: the live runtime, a restart in a run.
 *
 * @description
 * The cases, the fixture and the assertions live in `tests/vitests/setup/reload-held-code.mjs`.
 * @module tests/vitests/suites/core/reload-held-code-live-in-run-restart
 */

import { describeReloadHeldCode } from "../../setup/reload-held-code.mjs";

describeReloadHeldCode({ name: "reload-held-code-live-in-run-restart", runtimes: ["live"], sections: ["in-run"], operations: ["restart"] });
