/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_call_identity/api/ally.mjs
 *	@Date: 2026-11-11T15:00:00-08:00 (1794438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T15:00:00-08:00 (1794438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for who makes each access of a member expression: a module allowed the vault, whose accesses
 * have other modules' code running in and around them.
 * @module api_test_self_call_identity.ally
 */
import { self } from "@cldmv/slothlet/runtime";
import { board, attempt } from "../helpers/board.mjs";

/**
 * Leave this module's values on the board.
 * @returns {boolean} True.
 */
export function post() {
	board.kept = self.vault;
	board.keptGet = self.vault.get;
	board.allyLent = self.slothlet.lockCaller(() => self.vault.get());
	return true;
}

/**
 * Run one route.
 * @param {string} route - The route's name.
 * @returns {Promise<*>} Its outcome.
 */
export async function probe(route) {
	if (route === "call") return attempt(() => self.vault.get());
	if (route === "read") return attempt(() => self.vault.data.secret);
	if (route === "repeat") {
		const out = [];
		for (let i = 0; i < 3; i++)
			out.push(
				attempt(() => self.vault.get()),
				attempt(() => self.vault.data.secret)
			);
		return out;
	}
	// Another module's function is handed this module's view and uses it, with nothing of slothlet's run in between.
	if (route === "lentView") return attempt(() => board.use(self.vault));
	if (route === "lentViewRead") return attempt(() => board.useRead(self.vault));
	if (route === "lentMember") return attempt(() => board.call(self.vault.get));
	// Another module's function looks into the view in the middle of this module's member expression.
	if (route === "peekThenOwn") {
		const result = attempt(() => board.peek(self.vault).get());
		return [board.seen, result];
	}
	// A getter of another module runs inside this module's read.
	if (route === "getterOnPath") return attempt(() => [self.gate.box.peek, self.vault.get()]);
	// An argument expression calls another module.
	if (route === "argument") return attempt(() => [self.vault.echo(self.gate.tryVault()), self.vault.get()]);
	// The callee runs code it was handed: this module's, and another module's.
	if (route === "callbackOwn") return attempt(() => self.vault.run(() => self.vault.get()));
	if (route === "callbackForeign") return attempt(() => self.vault.run(board.thunk));
	// A member kept and called later, from this module's own timer and microtask.
	if (route === "timerOwn") {
		const get = self.vault.get;
		return new Promise((resolve) => setTimeout(() => resolve(attempt(() => get())), 2));
	}
	if (route === "microtaskOwn") {
		const vault = self.vault;
		return Promise.resolve().then(() => attempt(() => vault.get()));
	}
	if (route === "microtaskForeign") {
		const vault = self.vault;
		return Promise.resolve().then(() => attempt(() => board.use(vault)));
	}
	if (route === "gateLent") return attempt(() => board.gateLent());
	return "no such route";
}

/**
 * Try the vault after waiting, so calls of several modules overlap.
 * @param {number} ms - How long to wait.
 * @returns {Promise<Array<string>>} The outcomes of a call and a read.
 */
export async function slow(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
	const first = [attempt(() => self.vault.get()), attempt(() => self.vault.data.secret)];
	await null;
	return [...first, attempt(() => self.vault.get())];
}
