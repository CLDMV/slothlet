/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/admin/manage.mjs
 *	@Date: 2026-04-14 17:09:44 -07:00 (1776211784)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:28 -07:00 (1776211948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export const createUser = (name) => ({ ok: true, module: "admin", action: "create", name });
export const deleteUser = (id) => ({ ok: true, module: "admin", action: "delete", id });
export const setRole = (id, role) => ({ ok: true, module: "admin", action: "setRole", id, role });
