/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/payments-caller.mjs
 *	@Date: 2026-04-14 17:10:32 -07:00 (1776211832)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:10:33 -07:00 (1776211833)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

export const callCharge = (amount) => self.payments.charge.process(amount);
export const callAdmin = () => self.admin.manage.createUser("test");
export const callDbWrite = () => self.db.write.insert({ data: "test" });
export const callDbRead = () => self.db.read.query("SELECT 1");
export const callCache = () => self.cache.store.get("key1");
