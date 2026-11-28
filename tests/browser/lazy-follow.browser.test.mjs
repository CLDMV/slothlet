/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/lazy-follow.browser.test.mjs
 *	@Date: 2026-11-15T12:34:03-08:00 (1794774843)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:50-08:00 (1795869050)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In the browser: a self-named folder below the root whose file exports a primitive, a module's read of a node's `__type`, and a lazy folder node kept before it loaded as a primitive.
 *
 * @description
 * The rows are in `cases/lazy-follow.mjs`; each instance is composed in browser mode from a manifest of the fixture's files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/lazy-follow.mjs";

defineRows({ describe, it, expect }, "browser: primitive folders and node reports", rows, env);
