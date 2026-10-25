/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_gaps/base/probe.mjs
 *	@Date: 2026-10-25T09:27:44-07:00 (1792945664)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T11:37:46-07:00 (1792953466)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module keeping nodes — data, a namespace another module later makes callable, a
 * version dispatcher — and using them every way from a timer slothlet does not patch, after calling a kept async
 * function.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Record<string, *>} References kept for later. */
const kept = {};
/** @type {object|null} What the later uses gave. */
let outcome = null;

/**
 * Run a use, reporting what it gave or the code it threw.
 * @param {function(): *} use - The use.
 * @returns {*} What it gave (as JSON for objects), or the error code.
 */
function attempt(use) {
	try {
		const value = use();
		return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
	} catch (error) {
		return error.code ?? error.message;
	}
}

/**
 * Keep `store.work`, and the node at `name`.
 * @param {string} name - `obj` (store.obj), `farr` (store.farr) or `ns` (mounts.ns).
 * @returns {string} The kept node's `typeof`.
 */
export function keep(name) {
	kept.work = self.store.work;
	kept.node = name === "obj" ? self.store.obj : name === "farr" ? self.store.farr : self.mounts.ns;
	return typeof kept.node;
}

/**
 * From a timer slothlet does not patch, call the kept async function, then use the kept node every way.
 * @returns {Promise<string>} "armed".
 */
export async function useLater() {
	const timers = await import("node:timers");
	outcome = null;
	timers.setTimeout(() => {
		kept.work();
		const node = kept.node;
		outcome = {
			read: attempt(() => (Array.isArray(node) ? node[0] : node.n)),
			keys: attempt(() => Object.keys(node).filter((key) => !key.startsWith("__"))),
			has: attempt(() => "n" in node),
			descriptor: attempt(() => Object.getOwnPropertyDescriptor(node, Array.isArray(node) ? "0" : "n")?.value),
			json: attempt(() => (Array.isArray(node) ? JSON.parse(JSON.stringify(node))[0] : JSON.parse(JSON.stringify(node)).n)),
			spread: attempt(() => (Array.isArray(node) ? [...node][0] : { ...node }.n)),
			call: attempt(() => (typeof node.login === "function" ? node.login() : typeof node === "function" ? node() : "none"))
		};
	}, 0);
	return "armed";
}

/**
 * What the later uses gave.
 * @returns {object|null} The outcome, once the timer has run.
 */
export function result() {
	return outcome;
}
