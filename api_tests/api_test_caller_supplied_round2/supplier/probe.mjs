/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/supplier/probe.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier for the second round of caller-supplied-code tests (#597), mounted as a module of its
 * own. It may call the callee but not the vault's secret, and tries every way of having the callee — which may —
 * run its code as the callee: code compiled under the callee's file name, a value it changes after the callee
 * took it, a slothlet function bound for the callee to call, a getter the callee reads, a pin taken inside the
 * callee's call, and writes the callee owns.
 *
 * @module api_tests/api_test_caller_supplied_round2/supplier/probe
 */

import vm from "node:vm";
import Module from "node:module";
import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Start a call and capture its outcome, whether it throws synchronously or rejects.
 * @param {function(): *} invoke - The call.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @private
 */
function attempt(invoke) {
	try {
		return Promise.resolve(invoke()).then(
			(value) => ({ ok: true, value }),
			(error) => ({ ok: false, code: error?.code ?? String(error) })
		);
	} catch (error) {
		return Promise.resolve({ ok: false, code: error?.code ?? String(error) });
	}
}

/**
 * Bind leading arguments to a function without reading anything off it, as `Function.prototype.bind` does.
 * @param {Function} fn - The function.
 * @param {...*} args - The leading arguments.
 * @returns {Function} The bound function.
 * @private
 */
const bind = (fn, ...args) => Function.prototype.bind.call(fn, null, ...args);

/**
 * Wait one macrotask.
 * @returns {Promise<void>} Settles on the next turn.
 * @private
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The callee's module URL as its own frames spell it, read off the stack while the callee's frame is on it.
 * @returns {string} The URL.
 * @private
 */
function calleeLocation() {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = 200;
	const stack = new Error().stack;
	Error.stackTraceLimit = limit;
	for (const line of String(stack).split("\n")) {
		if (!line.includes("callee/ops.mjs")) continue;
		const match = /\((.+):\d+:\d+\)\s*$/.exec(line) ?? /at (?:async )?(.+):\d+:\d+\s*$/.exec(line);
		if (match) return match[1];
	}
	throw new Error("the callee's frame is not on the stack");
}

/**
 * Compile `body` as a function taking `(self, helpers)` under the callee's file name, the way `kind` names, and run
 * it.
 * @param {string} kind - `runInThisContext`, `Script`, `compileFunction` or `moduleCompile`.
 * @param {string} body - The function's body.
 * @returns {*} What it returned.
 * @private
 */
function forge(kind, body) {
	const filename = calleeLocation();
	const source = `(function (self, helpers) { ${body} })`;
	let fn;
	if (kind === "runInThisContext") fn = vm.runInThisContext(source, { filename });
	else if (kind === "Script") fn = new vm.Script(source, { filename }).runInThisContext();
	else if (kind === "compileFunction") fn = vm.compileFunction(`return ${source};`, [], { filename })();
	else {
		const compiled = new Module(filename);
		compiled._compile(`module.exports = ${source};`, filename);
		fn = compiled.exports;
	}
	return fn(self, { attempt });
}

/**
 * Have the callee run code compiled under its own file name, which calls the vault's secret — or, with `"whoami"`,
 * reports who the vault sees.
 * @param {string} kind - How the code is compiled (see {@link forge}).
 * @param {string} [target="secret"] - The vault target to call.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.forged("runInThisContext"); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function forged(kind, target = "secret") {
	return self.callee.ops.run(() => forge(kind, `return helpers.attempt(() => self.vault.secret.${target}());`));
}

/**
 * Hand the callee a plain object, then give it a `toString` while the callee awaits.
 * @returns {Promise<object>} The outcome of the call the `toString` made.
 * @public
 * @example
 * await api.supplier.probe.laterToString();
 */
export async function laterToString() {
	const value = {};
	let outcome = null;
	const pending = self.callee.ops.convertLater(value);
	value.toString = () => {
		outcome = attempt(() => self.vault.secret.secret());
		return "x";
	};
	await pending;
	return outcome;
}

/**
 * Hand the callee a plain object, then define a getter on it while the callee awaits.
 * @returns {Promise<object>} The outcome of the call the getter made.
 * @public
 * @example
 * await api.supplier.probe.laterGetter();
 */
export async function laterGetter() {
	const value = {};
	let outcome = null;
	const pending = self.callee.ops.readLater(value, "key");
	Object.defineProperty(value, "key", {
		get() {
			outcome = attempt(() => self.vault.secret.secret());
			return 1;
		}
	});
	await pending;
	return outcome;
}

/**
 * Hand the callee a plain object, then give it a prototype with a `toString` while the callee awaits.
 * @returns {Promise<object>} The outcome of the call the `toString` made.
 * @public
 * @example
 * await api.supplier.probe.laterPrototype();
 */
export async function laterPrototype() {
	const value = {};
	let outcome = null;
	const pending = self.callee.ops.convertLater(value);
	Object.setPrototypeOf(value, {
		toString() {
			outcome = attempt(() => self.vault.secret.secret());
			return "x";
		}
	});
	await pending;
	return outcome;
}

/**
 * Hand the callee a list of plain data, then put a function in it while the callee awaits.
 * @returns {Promise<object>} The outcome of the call the function made.
 * @public
 * @example
 * await api.supplier.probe.laterListEntry();
 */
export async function laterListEntry() {
	const list = [0];
	const pending = self.callee.ops.callFirstLater(list);
	list[0] = () => attempt(() => self.vault.secret.secret());
	return pending;
}

/**
 * Hand the callee a plain object and give it a `toString` from code the callee itself triggers, synchronously,
 * before converting it.
 * @returns {Promise<object>} The outcome of the call the `toString` made.
 * @public
 * @example
 * await api.supplier.probe.reentrantToString();
 */
export async function reentrantToString() {
	const value = {};
	let outcome = null;
	await self.supplier.hooks.arm(() => {
		value.toString = () => {
			outcome = attempt(() => self.vault.secret.secret());
			return "x";
		};
	});
	await self.callee.ops.convertAfterNotify(value);
	return outcome;
}

/** What the listener the callee subscribed saw. */
let heard = null;

/**
 * Have the callee subscribe this module's listener by handing it `event.on` bound to it.
 * @returns {Promise<object>} The outcome of the subscription.
 * @public
 * @example
 * await api.supplier.probe.boundEventOn();
 */
export async function boundEventOn() {
	heard = null;
	const listener = () => {
		heard = Promise.all([attempt(() => self.vault.secret.whoami()), attempt(() => self.vault.secret.secret())]);
	};
	return attempt(() => self.callee.ops.run(bind(self.slothlet.event.on, "round2.leak", listener)));
}

/**
 * What the listener subscribed by {@link boundEventOn} saw when the event fired.
 * @returns {Promise<{who: object, secret: object}|null>} Who the vault saw, and the secret call's outcome.
 * @public
 * @example
 * await api.supplier.probe.heardOutcome();
 */
export async function heardOutcome() {
	if (!heard) return null;
	const [who, secret] = await heard;
	return { who, secret };
}

/**
 * Have the callee register a hook on the secret by handing it `hook.on` bound to it.
 * @returns {Promise<object>} The outcome of the registration.
 * @public
 * @example
 * await api.supplier.probe.boundHookOn();
 */
export async function boundHookOn() {
	return attempt(() => self.callee.ops.run(bind(self.slothlet.hook.on, "vault.secret.secret:before", () => {})));
}

/** What the principal resolver registered through the callee saw. */
let resolved = null;

/**
 * Have the callee register a principal whose resolver calls the secret, by handing it `principal.register`.
 * @returns {Promise<object>} The outcome of the registration.
 * @public
 * @example
 * await api.supplier.probe.boundPrincipal();
 */
export async function boundPrincipal() {
	resolved = null;
	const definition = {
		key: () => "k",
		resolve: async () => {
			resolved = await attempt(() => self.vault.secret.secret());
			return {};
		}
	};
	return attempt(() => self.callee.ops.run(bind(self.slothlet.permissions.principal.register, "leak", definition)));
}

/**
 * Call the target whose rule requires the principal {@link boundPrincipal} registered, then report what its
 * resolver saw.
 * @returns {Promise<object|null>} The resolver's outcome.
 * @public
 * @example
 * await api.supplier.probe.resolvedOutcome();
 */
export async function resolvedOutcome() {
	await attempt(() => self.vault.secret.gate());
	return resolved;
}

/**
 * Have the callee open a scope around this module's code by handing it `scope` bound to it.
 * @returns {Promise<object>} The outcome of the secret call made inside the scope.
 * @public
 * @example
 * await api.supplier.probe.boundScope();
 */
export async function boundScope() {
	const outcome = await attempt(() =>
		self.callee.ops.run(bind(self.slothlet.scope, { context: {}, fn: () => attempt(() => self.vault.secret.secret()) }))
	);
	return outcome.ok ? outcome.value : outcome;
}

/**
 * Have the callee take a `lockCaller.caller` pin, which only the callee may, by handing it the function bound: the
 * supplier is refused the function itself.
 * @returns {Promise<object>} The outcome of taking the pin.
 * @public
 * @example
 * await api.supplier.probe.boundLockCallerCaller();
 */
export async function boundLockCallerCaller() {
	return attempt(() => self.callee.ops.run(bind(self.slothlet.lockCaller.caller, () => 1)));
}

/**
 * Read this module's getter from inside the callee's call.
 * @returns {Promise<object>} The outcome of the read.
 * @public
 * @example
 * await api.supplier.probe.getterThroughCallee();
 */
export async function getterThroughCallee() {
	return attempt(() => self.callee.ops.read(self.supplier.bag.box, "value"));
}

/**
 * Read the keeper's getter directly.
 * @returns {Promise<object>} The outcome of the read.
 * @public
 * @example
 * await api.supplier.probe.keeperGetter();
 */
export async function keeperGetter() {
	return attempt(() => self.keeper.box.held.value);
}

/**
 * Take a `lockCaller` pin from code run inside the callee's call, and from the pinned code hand the second callee
 * code that calls what the supplier and the second callee may, and the callee may not.
 * @returns {Promise<object>} The outcome of that call.
 * @public
 * @example
 * await api.supplier.probe.nestedPin();
 */
export async function nestedPin() {
	const pinned = self.callee.ops.run(() =>
		self.slothlet.lockCaller(() => self.callee2.ops.run(() => attempt(() => self.vault.secret.forSupplier())))
	);
	return pinned();
}

/**
 * Assign a member under the callee's mount from code run inside the callee's call.
 * @returns {Promise<object>} The outcome of the assignment.
 * @public
 * @example
 * await api.supplier.probe.plantInCallee();
 */
export async function plantInCallee() {
	return attempt(() =>
		self.callee.ops.run(() => {
			self["callee.planted"] = 2;
			return self.callee.planted;
		})
	);
}

/**
 * Write a context key the callee's scope owns from code run inside that scope.
 * @returns {Promise<object>} The outcome of the write.
 * @public
 * @example
 * await api.supplier.probe.writeCalleeContext();
 */
export async function writeCalleeContext() {
	return attempt(() =>
		self.callee.ops.scoped(() => {
			context.token = "forged";
			return context.token;
		})
	);
}

/**
 * Report which version of a versioned path code run inside the callee's call is routed to.
 * @returns {Promise<object>} The outcome of the call.
 * @public
 * @example
 * await api.supplier.probe.versionInCallee();
 */
export async function versionInCallee() {
	return attempt(() => self.callee.ops.run(() => self.auth.login.which()));
}

/**
 * Report which version of a versioned path this module is routed to.
 * @returns {Promise<object>} The outcome of the call.
 * @public
 * @example
 * await api.supplier.probe.versionDirect();
 */
export async function versionDirect() {
	return attempt(() => self.auth.login.which());
}

/**
 * Wait for deferred work to settle.
 * @returns {Promise<void>} Settles after a macrotask.
 * @public
 * @example
 * await api.supplier.probe.settle();
 */
export async function settle() {
	await tick();
}
