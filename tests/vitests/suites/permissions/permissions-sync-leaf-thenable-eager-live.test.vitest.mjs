/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-sync-leaf-thenable-eager-live.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T20:28:46-08:00 (1795667326)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #599 — code a synchronous leaf hands back runs as that leaf's module, not as the caller awaiting it:
 * the EAGER_LIVE and EAGER_LIVE_HOOKS matrix configs.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/permissions-sync-leaf-thenable.mjs`; this file runs them under
 * the EAGER_LIVE and EAGER_LIVE_HOOKS configs.
 * @module tests/vitests/suites/permissions/permissions-sync-leaf-thenable-eager-live
 */

import { describeSyncLeafThenable } from "../../setup/permissions-sync-leaf-thenable.mjs";

describeSyncLeafThenable(["EAGER_LIVE", "EAGER_LIVE_HOOKS"]);
