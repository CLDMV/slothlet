/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/api-root.browser.test.mjs
 *	@Date: 2026-11-15T12:34:03-08:00 (1794774843)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:47-08:00 (1795869047)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In the browser: changes to the api root are made on the api and held to a node's write rules, and deleting a member of a function node removes it.
 *
 * @description
 * The rows are in `cases/api-root.mjs`; each instance is composed in browser mode from a manifest of the fixture's files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/api-root.mjs";

defineRows({ describe, it, expect }, "browser: the api root's integrity", rows, env);
