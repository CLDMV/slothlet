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

// Counterpart to payments-caller.gatedDbWrite. This module is NOT permitted to write, so if it
// resumes carrying the other caller's identity the write succeeds — a bypass. Reports the outcome
// instead of throwing so one test can assert on both callers.
export const gatedDbWrite = async (gate) => {
	await gate;
	try {
		return { ok: true, result: await self.db.write.insert({ data: "gated" }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

// A second gated entry point in this same module, reached through a module-private helper so the
// innermost stack frame belongs to the helper rather than to either export. Used to check that two
// suspended calls sharing one file are still told apart — permissions key on the api path, so the
// distinction that matters is which *function* is calling, not which file.
const attemptWrite = async () => {
	try {
		return { ok: true, result: await self.db.write.insert({ data: "sibling" }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};
export const gatedSibling = async (gate) => {
	await gate;
	return attemptWrite();
};
