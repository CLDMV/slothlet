/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/untrusted-caller.mjs
 *	@Date: 2026-04-14 17:10:52 -07:00 (1776211852)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:28 -07:00 (1776211948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

export const callPayments = () => self.payments.charge.process(50);
export const callAdmin = () => self.admin.manage.createUser("hacker");
export const callDbWrite = () => self.db.write.insert({ data: "malicious" });
export const callDbRead = () => self.db.read.query("SELECT * FROM users");
export const callCache = () => self.cache.store.get("secret");
