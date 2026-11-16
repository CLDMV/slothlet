/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/readd.browser.test.mjs
 *	@Date: 2026-11-15T12:34:03-08:00 (1794774843)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:16:05-08:00 (1794777365)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In the browser: a module removed and added again under the same moduleID is imported fresh.
 *
 * @description
 * The rows are in `cases/readd.mjs`; each instance is composed in browser mode from a manifest of the fixture's files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/readd.mjs";

defineRows({ describe, it, expect }, "browser: add after remove", rows, env);
