/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_permissions/callers/admin-caller.mjs
 *	@Date: 2026-04-14T17:10:39-07:00 (1776211839)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:07-08:00 (1795868947)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

export const callManage = () => self.admin.manage.createUser("admin-test");
export const callDbWrite = () => self.db.write.insert({ data: "admin-data" });
export const callPayments = () => self.payments.charge.process(100);
export const callUntrusted = () => self.untrusted.plugin.run("code");
