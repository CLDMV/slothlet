/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/evil/x.mjs
 *	@Date: 2026-10-18T02:19:28-07:00 (1792315168)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T14:48:50-07:00 (1792360130)
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

/**
 * Try to replace `callee.ops.useSecret`, recording the outcome.
 * @param {object} root - What to reach `callee` through: `self`, or an `api` the module was handed.
 * @param {Array<string>} out - Outcomes: `"written"`, or the refusal's code.
 * @returns {void}
 */
function tryReplace(root, out) {
	try {
		root.callee.ops.useSecret = () => "pwned";
		out.push("written");
	} catch (error) {
		out.push(error?.code ?? String(error));
	}
}

/**
 * A function that runs `fn` on its first call only: a write that lands creates a node, which fires the
 * event again.
 * @param {Function} fn - The function.
 * @returns {Function} The once-only function.
 */
function once(fn) {
	let done = false;
	return (...args) => {
		if (done) return;
		done = true;
		fn(...args);
	};
}

/**
 * Subscribe to `impl:created` with a handler that writes another module's member when it runs.
 * @returns {{ get: Function }} Reads back the outcomes.
 */
export function subscribeWriter() {
	const out = [];
	self.slothlet.lifecycle.on(
		"impl:created",
		once(() => tryReplace(self, out))
	);
	return { get: () => out };
}

/**
 * Register a hook of `type` on `path` whose handler carries a `_slothletOriginal` of its own, as a pinned
 * handler does, and writes another module's member when it runs.
 * @param {string} path - Api path to hook.
 * @param {string} type - Hook type.
 * @returns {{ get: Function }} Reads back the outcomes.
 */
export function forgedHook(path, type) {
	const out = [];
	const handler = (payload) => {
		tryReplace(self, out);
		return type === "around" ? payload.next() : undefined;
	};
	handler._slothletOriginal = () => {};
	self.slothlet.hook.on(`${path}:${type}`, handler);
	return { get: () => out };
}

/**
 * Take the version dispatcher at `auth`, or what it hands back, and write `login` through it later.
 * @param {"kept"|"inspect"|"descriptor"|"valueOf"} how - What to write through.
 * @returns {Function} The deferred write.
 */
export function dispatcherLeak(how) {
	const custom = Symbol.for("nodejs.util.inspect.custom");
	const identity = (value) => value;
	let node = self.auth;
	if (how === "inspect") node = self.auth[custom](0, {}, identity);
	if (how === "descriptor") node = Object.getOwnPropertyDescriptor(self.auth, custom).value(0, {}, identity);
	if (how === "valueOf") node = self.auth.valueOf();
	return () => {
		node.login = () => "pwned-through-dispatcher";
	};
}

/**
 * Keep a function of the framework's namespace and call it later.
 * @param {"getAPI"|"describe"|"hook"|"lifecycle"} how - Which function.
 * @returns {{ later: Function, get: Function }} The deferred call, and what any handler it registered recorded.
 */
export function keepFrameworkFn(how) {
	const out = [];
	if (how === "getAPI" || how === "describe") {
		const fn = self.slothlet.diag[how];
		return {
			later: () => {
				fn(true).callee.ops.useSecret = () => "pwned-through-diag";
			},
			get: () => out
		};
	}
	if (how === "hook") {
		const on = self.slothlet.hook.on;
		return { later: () => on("callee.ops.writeOwnNested:before", (payload) => tryReplace(payload.api, out)), get: () => out };
	}
	const on = self.slothlet.lifecycle.on;
	return {
		later: () =>
			on(
				"impl:created",
				once(() => tryReplace(self, out))
			),
		get: () => out
	};
}

/**
 * Register a hook of `type` on `path` that changes the call's arguments in place, as plain JS would.
 * @param {string} path - Api path to hook.
 * @param {string} type - Hook type.
 * @param {"set"|"push"} how - Replace the first argument, or append one.
 * @returns {void}
 */
export function mutateArgsHook(path, type, how) {
	self.slothlet.hook.on(`${path}:${type}`, (payload) => {
		if (how === "set") payload.args[0] = "mut";
		else payload.args.push("extra");
		return type === "around" ? payload.next() : undefined;
	});
}

/**
 * Register an error hook on `path` that keeps the error it is handed.
 * @param {string} path - Api path to hook.
 * @returns {{ get: Function }} Reads back the kept error.
 */
export function keepErrorHook(path) {
	const kept = {};
	self.slothlet.hook.on(`${path}:error`, (payload) => {
		kept.error = payload.error;
	});
	return { get: () => kept.error };
}

/**
 * Keep `self.slothlet.lockCaller.caller` and hand back a function that, called later, pins a callback
 * with it and runs it: the callback replaces a member of `callee`.
 * @returns {Function} The deferred pin-and-run.
 */
export function keepCallerPin() {
	const pin = self.slothlet.lockCaller.caller;
	return () =>
		pin(() => {
			self.callee.ops.useSecret = () => "pwned-through-caller-pin";
		})();
}

/**
 * Keep `self.slothlet.context.run` to hand to whoever calls it later.
 * @returns {{ run: Function }} The kept function.
 */
export function keepContextRun() {
	return { run: self.slothlet.context.run };
}

/**
 * Pin `job` to this leaf's caller.
 * @param {Function} job - The job.
 * @returns {{ job: Function }} The pinned job.
 */
export function pinForCaller(job) {
	return { job: self.slothlet.lockCaller.caller(job) };
}
