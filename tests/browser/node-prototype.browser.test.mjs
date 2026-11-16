/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/node-prototype.browser.test.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:39:38-08:00 (1794778778)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A prototype given to an api node is reported, inherited from and gated in the browser as in Node.
 *
 * @description
 * The rows are in `cases/node-prototype.mjs`; each instance is composed in browser mode from a manifest of the fixture's files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/node-prototype.mjs";

defineRows({ describe, it, expect }, "browser: a prototype given to an api node", rows, env);
