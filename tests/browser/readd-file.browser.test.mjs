/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/readd-file.browser.test.mjs
 *	@Date: 2026-11-15T17:09:19-08:00 (1794791359)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:46:58-08:00 (1794797218)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A single file removed and added again under the same moduleID is imported fresh in the browser.
 *
 * @description
 * The rows are in `cases/readd-file.mjs`; each instance is composed in browser mode from a manifest of the fixture's
 * files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/readd-file.mjs";

defineRows({ describe, it, expect }, "browser: a single file added again", rows, env);
