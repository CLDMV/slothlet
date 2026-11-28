/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/setup/env-preload.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:04-08:00 (1795869064)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { existsSync } from "node:fs";

process.env.NODE_ENV ??= "development";
// Source mode only: with no `src/` (post-build dist run) the config deliberately strips `slothlet-dev`
// from NODE_OPTIONS, and defaulting it back would resolve the graph into the deleted `src/` tree.
if (existsSync(new URL("../../../src/slothlet.mjs", import.meta.url))) {
	process.env.NODE_OPTIONS ??= "--conditions=slothlet-dev";
}
