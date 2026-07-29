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
export const callWebhook = (event) => self.payments.webhook.handleWebhook(event);
export const callAdmin = () => self.admin.manage.createUser("test");
export const callDbWrite = () => self.db.write.insert({ data: "test" });
export const callDbRead = () => self.db.read.query("SELECT 1");
export const callCache = () => self.cache.store.get("key1");

// Suspends on a caller-supplied gate, then writes. Paired with the matching export on
// untrusted-caller, this holds two calls open at once so the live runtime's single ambient
// identity field can only name one of them. This module IS permitted to write, so it also checks
// the permitted caller is not collaterally denied while the other is being refused.
export const gatedDbWrite = async (gate) => {
	await gate;
	return self.db.write.insert({ data: "gated" });
};
