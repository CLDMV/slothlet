/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_permissions/untrusted/plugin.mjs
 *	@Date: 2026-04-14T17:10:23-07:00 (1776211823)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:08-08:00 (1795868948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

export const run = (code) => ({ ok: true, module: "untrusted", action: "run", code });
export const probe = (target) => ({ ok: true, module: "untrusted", action: "probe", target });
