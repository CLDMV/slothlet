/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/function-default-members.browser.test.mjs
 *	@Date: 2026-11-15T12:31:01-08:00 (1794774661)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:16:00-08:00 (1794777360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default function's named exports called `name`, `length`, `prototype` or like the function itself
 * are its members in the browser, and a function node lists its keys in a function's order.
 *
 * @description
 * The rows are in `cases/function-default-members.mjs`; the instance is composed in browser mode from a manifest of
 * `api_test_browser_fn_members`.
 */

import { describe, it, expect } from "vitest";
import { env } from "./helpers/browser-env.mjs";
import { defineRows } from "./helpers/rows.mjs";
import { rows } from "./cases/function-default-members.mjs";

defineRows({ describe, it, expect }, "browser: a default function's named exports", rows, env);
