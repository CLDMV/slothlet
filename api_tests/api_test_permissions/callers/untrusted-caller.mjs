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

// Stash an api function while holding it, then invoke that stashed reference from a boundary slothlet
// does not patch, so the invocation carries no caller of its own. Nothing reads `self` at call time —
// the reference is already in hand — so the executing-module guard has nothing to refuse. What has to
// stop it is the identity captured when the reference was taken.
//
// `node:timers` is the unpatched boundary here because its ESM named exports are a snapshot taken at
// first link, which no patch applied later can reach.
let stashed = null;
let stashedOutcome = null;
export const stashInsertRef = () => {
	stashed = self.db.write.insert;
	return "stashed";
};
export const invokeStashedFromUnpatched = async () => {
	const timers = await import("node:timers");
	timers.setTimeout(async () => {
		try {
			stashedOutcome = { ok: true, value: await stashed({ x: 1 }) };
		} catch (err) {
			stashedOutcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}
	}, 5);
	return "armed";
};
export const readStashedOutcome = () => stashedOutcome;

// Invoke a reference a DIFFERENT module captured and handed over. Binding the captured identity onto
// a reference must not become a way to lend authority — this module is unprivileged, and calling it
// here has to be refused on this module's own account even though a permitted module took the
// reference. Invoked in flight, so this module is the live caller.
export const callLent = async (ref) => {
	try {
		return { ok: true, value: await ref({ x: 1 }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

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

// Reaches for a high-privilege internal `slothlet.*` route while a permitted sibling is suspended.
// Success would mean this module borrowed that sibling's authority over the routes that introspect
// and mutate the permission system itself.
export const gatedInternalRoute = async (gate) => {
	await gate;
	try {
		return { ok: true, count: (await self.slothlet.permissions.global.rulesForPath("db.write.insert")).length };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

// Blinds V8's stack formatter and replaces the global Error constructor, then makes a gated call
// while a permitted sibling is suspended. Caller identity is resolved from the stack in that
// window, so a leaf that can control how stacks are produced could otherwise make itself
// unattributable — and an unattributable caller must be refused, not exempted.
export const gatedWithBlindedStack = async (gate) => {
	await gate;
	const previousPrepare = Error.prepareStackTrace;
	const RealError = globalThis.Error;
	Error.prepareStackTrace = () => "";
	globalThis.Error = class BlindError {
		constructor() {
			this.stack = "";
		}
	};
	try {
		return { ok: true, result: await self.db.write.insert({ data: "blinded" }) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	} finally {
		globalThis.Error = RealError;
		Error.prepareStackTrace = previousPrepare;
	}
};

// The reverse of `callLent`: this unprivileged module captures a reference it may not call, and hands
// it to a module that may. The capturing module's own lack of access has to travel with the reference,
// or an unprivileged module could get its work done by proxy through a privileged one.
export const captureAndHandOff = async () => {
	const ref = self.db.write.insert;
	return self.callers.paymentsCaller.invokeLent(ref);
};
