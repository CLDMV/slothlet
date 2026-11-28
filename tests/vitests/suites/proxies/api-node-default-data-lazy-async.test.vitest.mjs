/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/api-node-default-data-lazy-async.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:50-08:00 (1795869170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node of a file's default export that is built-in data (a map, a set, a date, an error) answers
 * another module as the same data reached as a named export does: lazy mode, the async runtime.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/api-node-default-data.mjs`.
 * @module tests/vitests/suites/proxies/api-node-default-data-lazy-async
 */

import { describeApiNodeDefaultData } from "../../setup/api-node-default-data.mjs";

describeApiNodeDefaultData({ modes: ["lazy"], runtimes: ["async"] });
