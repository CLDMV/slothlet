/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/fixtures/frame-placement-tdz-namespace.mjs
 *	@Date: 2026-11-25T01:28:22-08:00 (1795598902)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:44:59-08:00 (1795599899)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands its own namespace to a check while one of its bindings is not initialised yet.
 * @module tests/vitests/suites/context/fixtures/frame-placement-tdz-namespace
 */
import * as self from "./frame-placement-tdz-namespace.mjs";

/**
 * What the check answered for this module's namespace, read before `late` is initialised.
 * @type {object}
 */
export const early = globalThis.__framePlacementCheck(self);

/**
 * Initialised after the check runs.
 * @type {number}
 */
export let late = 1;
export { late as default };
