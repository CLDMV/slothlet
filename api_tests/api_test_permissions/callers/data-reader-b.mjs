/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/data-reader-b.mjs
 *	@Date: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

// Second caller module that reads the same terminal data values as data-reader.mjs.
// Pairs with the multi-caller waiting-proxy regression test: the waitingProxyCache
// may hand the same proxy to both callers when the path is unmaterialized, so the
// read-gate snapshot must be per-await — not per-creation — to attribute the
// decision (and audit event) to the actual reader.
export const readToken = () => self.db.secrets.token;
