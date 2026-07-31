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

// Suspends on a gate, then reads an internal `slothlet.*` route. Paired with the untrusted
// counterpart so one permitted and one denied caller are in flight together.
export const gatedInternalRoute = async (gate) => {
	await gate;
	return { ok: true, count: (await self.slothlet.permissions.global.rulesForPath("db.write.insert")).length };
};

// Capture an api function this module IS permitted to use, then hand the reference to a module that is
// not. Enforcing the captured identity must not turn a captured reference into a transferable
// capability — the recipient is still checked on its own account.
export const lendInsertRef = async () => {
	const ref = self.db.write.insert;
	return self.callers.untrustedCaller.callLent(ref);
};

// Two reads of one path must hand back the same object. Any per-reader view the runtime interposes has
// to be cached, or code that compares or de-duplicates api functions silently stops matching.
export const sameRefTwice = () => self.db.write.insert === self.db.write.insert;

// This module is permitted, so its own captured reference must keep working — attribution should cost
// a permitted module nothing.
export const useOwnCapturedRef = async () => {
	const ref = self.db.write.insert;
	try {
		return { ok: true, value: await ref({ x: 1 }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

// Invoke a reference another module captured and handed over. This module IS permitted, so only the
// captured identity can refuse it.
export const invokeLent = async (ref) => {
	try {
		return { ok: true, value: await ref({ x: 1 }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};
