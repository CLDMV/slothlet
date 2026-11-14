/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_callable_root/samename/samename.mjs
 *	@Date: 2026-11-11T12:19:09-08:00 (1794428349)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:33-08:00 (1794431613)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file named after its folder, with code outside every export that a leaf hands out.
 * @module api_test_toplevel_callable_root/samename
 */

import { self } from "@cldmv/slothlet/runtime";

/** Code of this file outside every export. */
const helper = () => self.vault.get();

export const give = () => helper;
export const direct = () => self.vault.get();
