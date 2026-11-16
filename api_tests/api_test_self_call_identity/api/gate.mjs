/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_call_identity/api/gate.mjs
 *	@Date: 2026-11-11T12:33:39-08:00 (1794429219)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:27-08:00 (1794431607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for who makes each access of a member expression: a module denied the vault. It leaves
 * functions of its own where an allowed module runs them, and holds a getter an allowed module reads through.
 * @module api_test_self_call_identity.gate
 */
import { self } from "@cldmv/slothlet/runtime";
import { board, attempt } from "../helpers/board.mjs";

/**
 * Leave this module's functions on the board.
 * @returns {boolean} True.
 */
export function post() {
	board.use = (view) => view.get();
	board.useRead = (view) => view.data.secret;
	board.call = (fn) => fn();
	board.peek = (view) => {
		board.seen = attempt(() => view.data.secret);
		return view;
	};
	board.thunk = () => self.vault.get();
	board.gateLent = self.slothlet.lockCaller(() => self.vault.get());
	return true;
}

/**
 * An object with a getter that tries the vault while another module's read runs it.
 * @type {{peek: string, plain: number}}
 */
export const box = {
	get peek() {
		// Reads this node again, then the vault, as this module.
		return attempt(() => `${self.gate.box.plain}:${self.vault.get()}`);
	},
	plain: 1
};

/**
 * Try the vault from a leaf.
 * @returns {string} The outcome.
 */
export function tryVault() {
	return attempt(() => self.vault.get());
}

/**
 * Run one route.
 * @param {string} route - The route's name.
 * @returns {Promise<*>} Its outcome.
 */
export async function probe(route) {
	if (route === "call") return attempt(() => self.vault.get());
	if (route === "read") return attempt(() => self.vault.data.secret);
	if (route === "useKept") return attempt(() => board.kept.get());
	if (route === "useKeptRead") return attempt(() => board.kept.data.secret);
	if (route === "useKeptMember") return attempt(() => board.keptGet());
	if (route === "allyLent") return attempt(() => board.allyLent());
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
