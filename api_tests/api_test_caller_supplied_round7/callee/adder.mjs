/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/callee/adder.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T11:46:40-07:00 (1792349200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that adds another at runtime (#597): its add stays in flight while the added module's top
 * level awaits, and its own calls answer meanwhile.
 *
 * @module api_tests/api_test_caller_supplied_round7/callee/adder
 */

import vm from "node:vm";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Add a module whose top level awaits before it finishes loading, leaving it the vault on `globalThis`.
 * @param {string} dir - The module's folder.
 * @param {string} [name] - Where to mount it, and its moduleID's stem.
 * @returns {Promise<string>} What the callee's own call reads after the add settles.
 * @public
 * @example
 * await api.callee.adder.addWhile(dir); // "s3cret"
 */
export async function addWhile(dir, name = "slowplug") {
	globalThis.__slothletRound7Vault = self.vault;
	await self.slothlet.api.add(name, dir, { moduleID: `${name}-mod` });
	return self.vault.secret.secret();
}

/**
 * Read the secret synchronously, as the callee.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.adder.sync(); // "s3cret"
 */
export function sync() {
	return self.vault.secret.secret();
}

/**
 * The add {@link addDetached} started, while it is in flight.
 * @type {Promise<string>|null}
 * @private
 */
let detached = null;

/**
 * Start adding a module and return before it is added: the callee's call is over while the module is still built. The
 * module is left the vault on `globalThis`.
 * @param {string} dir - The module's folder.
 * @param {string} [name] - Where to mount it, and its moduleID's stem.
 * @returns {string} "started".
 * @public
 * @example
 * api.callee.adder.addDetached(dir); // "started"
 */
export function addDetached(dir, name = "slowplug") {
	globalThis.__slothletRound7Vault = self.vault;
	detached = self.slothlet.api.add(name, dir, { moduleID: `${name}-mod` }).then(
		() => "added",
		(error) => error?.code ?? "threw"
	);
	return "started";
}

/**
 * How the add {@link addDetached} started settled.
 * @returns {Promise<string>} "added", or why it failed.
 * @public
 * @example
 * await api.callee.adder.detachedSettled(); // "added"
 */
export function detachedSettled() {
	return detached;
}

/**
 * Schedule a timer whose callback returns a promise that never settles.
 * @returns {void}
 * @public
 * @example
 * api.callee.adder.timerHangs();
 */
export function timerHangs() {
	setTimeout(() => new Promise(() => {}), 0);
}

/**
 * How many times something inspected the promise {@link timerInspectable}'s callback returned.
 * @type {number}
 * @private
 */
let inspections = 0;

/**
 * Schedule a timer whose callback returns a pending promise carrying an inspector of its own and a tag of its own,
 * which settles shortly after.
 * @returns {void}
 * @public
 * @example
 * api.callee.adder.timerInspectable();
 */
export function timerInspectable() {
	setTimeout(() => {
		const pending = new Promise((resolve) => setTimeout(resolve, 10));
		pending[Symbol.for("nodejs.util.inspect.custom")] = () => {
			inspections++;
			return "Promise { 1 }";
		};
		Object.defineProperty(pending, Symbol.toStringTag, { value: "Tagged" });
		return pending;
	}, 0);
}

/**
 * How many times the promise {@link timerInspectable}'s callback returned was inspected.
 * @returns {number} The count.
 * @public
 * @example
 * api.callee.adder.inspected(); // 0
 */
export function inspected() {
	return inspections;
}

/**
 * A promise of the subclass {@link timerReturns} can return.
 * @private
 */
class Deferred extends Promise {}

/**
 * Make a promise that rejects, of a kind.
 * @param {"native"|"own"|"subclass"|"realm"} kind - A native promise, one carrying a property of its own, one of a
 *   subclass, or one of another realm.
 * @returns {Promise<never>} The promise.
 * @private
 */
function rejecting(kind) {
	if (kind === "own") {
		const promise = Promise.reject(new Error(`round7-${kind}`));
		promise.extra = 1;
		return promise;
	}
	if (kind === "subclass") return Deferred.reject(new Error(`round7-${kind}`));
	if (kind === "realm") return vm.runInNewContext(`Promise.reject(new Error("round7-${kind}"))`);
	return Promise.reject(new Error(`round7-${kind}`));
}

/**
 * Schedule a timer whose callback returns a promise that rejects, of a kind, handled by the callback or left unhandled.
 * @param {"native"|"own"|"subclass"|"realm"} kind - The promise's kind.
 * @param {boolean} handled - Whether the callback handles its rejection.
 * @returns {void}
 * @public
 * @example
 * api.callee.adder.timerReturns("subclass", true);
 */
export function timerReturns(kind, handled) {
	setTimeout(() => {
		const promise = rejecting(kind);
		if (handled) promise.catch(() => {});
		return promise;
	}, 0);
}
