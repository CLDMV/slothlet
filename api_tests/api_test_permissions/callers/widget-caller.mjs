/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/widget-caller.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Constructs a `widgets.Widget` from inside a module boundary so the `construct`
 * trap's permission enforcement is exercised. Awaited so lazy mode (which returns a
 * Promise from the construct trap) and eager mode both resolve to the raw instance.
 * @param {string} label - Label forwarded to the Widget constructor.
 * @returns {Promise<object>} The constructed Widget instance.
 */
export const construct = async (label) => await new self.widgets.Widget(label);
