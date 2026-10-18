/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/evil/x.mjs
 *	@Date: 2026-10-18T02:19:28-07:00 (1792315168)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T02:33:11-07:00 (1792315991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Mounted at apiPath "evil" (moduleID "evil") by the nested self-assign ownership tests (#625). Each
 * export reaches another module's node through a side channel around the views `self` hands out: a
 * receiver it steers a method onto, the `api` and values a hook it registered is handed, and the impl
 * a lifecycle event it subscribed to delivers.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Write the receiver's `secret`.
 * @returns {void}
 */
export function mutate() {
	this.secret = "pwned";
}

/**
 * Steer {@link mutate} onto another module's node.
 * @param {string} name - Member of `svc` to steer it onto.
 * @returns {void}
 */
export function go(name) {
	self.evil.x.mutate.call(self.svc[name]);
}

/**
 * Steer a method of `callee` that writes its receiver onto a node of `svc`.
 * @param {string} name - Member of `svc` to steer it onto.
 * @returns {void}
 */
export function steer(name) {
	self.callee.ops.setSecret.call(self.svc[name], "pwned-by-steer");
}

/**
 * Register a hook of `type` on `path` that keeps what it is handed.
 * @param {string} path - Api path to hook.
 * @param {string} type - Hook type.
 * @returns {{ get: Function }} Reads back what the hook kept.
 */
export function keepHook(path, type) {
	const kept = {};
	self.slothlet.hook.on(`${path}:${type}`, (payload) => {
		kept.api = payload.api;
		kept.args = payload.args;
		if (type === "around") {
			kept.result = payload.next();
			return kept.result;
		}
		kept.result = payload.result;
		return type === "after" ? payload.result : undefined;
	});
	return { get: () => kept };
}

/**
 * Subscribe to a lifecycle event and keep the impl of every event under `prefix`.
 * @param {string} event - Lifecycle event.
 * @param {string} prefix - Api path prefix to keep.
 * @returns {{ get: Function }} Reads back the kept impls.
 */
export function keepLifecycle(event, prefix) {
	const kept = [];
	self.slothlet.lifecycle.on(event, (data) => {
		if (String(data.apiPath).startsWith(prefix)) kept.push(data.impl);
	});
	return { get: () => kept };
}

/**
 * Take another module's node from the diagnostics namespace and write it later.
 * @param {"describe"|"getAPI"} how - Diagnostics member to take it from.
 * @returns {Function} Writes the node.
 */
export function keepDiag(how) {
	const node = how === "describe" ? self.slothlet.diag.describe(true).callee.ops : self.slothlet.diag.getAPI().callee.ops;
	return () => {
		node.useSecret = () => "pwned-by-diag";
	};
}
