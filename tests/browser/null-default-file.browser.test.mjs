/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/null-default-file.browser.test.mjs
 *	@Date: 2026-11-15T17:09:02-08:00 (1794791342)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:51-08:00 (1795869051)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A single file whose default export is `null` or `undefined`, added with `api.slothlet.api.add()`,
 * reads as that value in the browser.
 *
 * @description
 * The rows are in `cases/null-default-file.mjs`; each instance is composed in browser mode from a manifest of the
 * fixture's files.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/null-default-file.mjs";

defineRows({ describe, it, expect }, "browser: a single-file add of a null or undefined default export", rows, env);
