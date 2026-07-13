/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks_fail/broken/broken.mjs
 *	@Date: 2026-07-11 08:37:55 -07:00 (1783784275)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-11 08:37:55 -07:00 (1783784275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf that intentionally throws at import time so its lazy wrapper fails to
 * materialize. Used to prove `_collectLifecycleHooks` bails on a materialize-failed subtree
 * instead of recording a false-positive hook from a leftover "waiting proxy". Loaded only in
 * lazy mode (eager boot would surface the throw at load time, which is the point of the test).
 * @module api_test_lifecycle_hooks_fail.broken
 * @memberof module:api_test_lifecycle_hooks_fail
 */

throw new Error("intentional materialize failure (F1 lazy false-positive guard fixture)");
