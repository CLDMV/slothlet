/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_permissions/db/read.mjs
 *	@Date: 2026-04-14T17:09:54-07:00 (1776211794)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:08-08:00 (1795868948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

export const query = (sql) => ({ ok: true, module: "db.read", sql });
export const getById = (id) => ({ ok: true, module: "db.read", id });
