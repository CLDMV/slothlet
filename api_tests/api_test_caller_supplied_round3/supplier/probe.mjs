/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/supplier/probe.mjs
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
 * @fileoverview The supplier for the third round of caller-supplied-code tests (#597), mounted as a module of its
 * own. It may call the callee but not the vault's secret, and tries to have the callee — which may — run its code as
 * the callee: code compiled under a file name inside the callee's folder, and code on its own api objects that the
 * callee runs by spreading, reading or calling them.
 *
 * @module api_tests/api_test_caller_supplied_round3/supplier/probe
 */

import vm from "node:vm";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { self } from "@cldmv/slothlet/runtime";

/**
 * The callee's folder, as a plain path.
 * @type {string}
 * @private
 */
const CALLEE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "callee");

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
 * Call the vault's secret, reporting the outcome as a value.
 * @returns {string} The secret, or the refusal's code.
 * @private
 */
function grab() {
	try {
		return self.vault.secret.secret();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Compile a function under `filename`, the way `kind` names, that returns a closure calling `self.vault.secret` with
 * `target` itself — no frame of this module's is on the stack when it runs.
 * @param {string} kind - `runInThisContext`, `Script`, `compileFunction` or `moduleCompile`.
 * @param {string} filename - The file name to compile under.
 * @param {string} target - The vault target the closure calls.
 * @returns {function(): *} The closure.
 * @private
 */
function forge(kind, filename, target) {
	const source = "(function (self, target) { return function forged() { return self.vault.secret[target](); }; })";
	let outer;
	if (kind === "runInThisContext") outer = vm.runInThisContext(source, { filename });
	else if (kind === "Script") outer = new vm.Script(source, { filename }).runInThisContext();
	else if (kind === "compileFunction") outer = vm.compileFunction(`return ${source};`, [], { filename })();
	else {
		const compiled = new Module(filename);
		compiled._compile(`module.exports = ${source};`, filename);
		outer = compiled.exports;
	}
	return outer(self, target);
}

/**
 * Have the callee run a closure compiled under a file name in its own folder — one that does not exist, or one that
 * does and holds other code — that calls the vault's secret, or with `"whoami"` reports who the vault sees.
 * @param {string} kind - How the code is compiled (see {@link forge}).
 * @param {string} file - The file name, relative to the callee's folder.
 * @param {string} [target="secret"] - The vault target to call.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.forgedInFolder("compileFunction", "zz-not-real.mjs"); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function forgedInFolder(kind, file, target = "secret") {
	const closure = forge(kind, path.join(CALLEE_DIR, file), target);
	return attempt(() => self.callee.ops.run(closure));
}

/**
 * Have the callee spread this module's iterable.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.iteratorThroughCallee(); // { ok: true, value: ["PERMISSION_DENIED"] }
 */
export async function iteratorThroughCallee() {
	return attempt(() => self.callee.ops.spread(self.supplier.bag.iter));
}

/**
 * Have the callee call the function this module's object holds under a symbol.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.symbolThroughCallee(); // { ok: true, value: "PERMISSION_DENIED" }
 */
export async function symbolThroughCallee() {
	return attempt(() => self.callee.ops.callSymbol(self.supplier.bag.symbolic, Symbol.for("round3.grab")));
}

/**
 * Define a getter on this module's api object at runtime, then have the callee read it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.definedGetterThroughCallee(); // { ok: true, value: "PERMISSION_DENIED" }
 */
export async function definedGetterThroughCallee() {
	Object.defineProperty(self.supplier.bag.late, "defined", { get: grab, enumerable: true, configurable: true });
	return attempt(() => self.callee.ops.read(self.supplier.bag.late, "defined"));
}

/**
 * Assign an object with a getter to this module's api object at runtime, then have the callee read through it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.assignedGetterThroughCallee(); // { ok: true, value: "PERMISSION_DENIED" }
 */
export async function assignedGetterThroughCallee() {
	self.supplier.bag.late.assigned = {
		get value() {
			return grab();
		}
	};
	return attempt(() => self.callee.ops.readNested(self.supplier.bag.late, "assigned", "value"));
}

/**
 * Define a getter on this module's api object at runtime, then have the callee read every member of it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.valuesThroughCallee(); // { ok: true, value: [1, "PERMISSION_DENIED"] }
 */
export async function valuesThroughCallee() {
	Object.defineProperty(self.supplier.bag.late, "listed", { get: grab, enumerable: true, configurable: true });
	return attempt(() => self.callee.ops.values(self.supplier.bag.late));
}

/**
 * Read the runtime-defined getter itself, as the supplier.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.definedGetterOwn(); // { ok: true, value: "PERMISSION_DENIED" }
 */
export async function definedGetterOwn() {
	Object.defineProperty(self.supplier.bag.late, "own", { get: grab, enumerable: true, configurable: true });
	return attempt(() => self.supplier.bag.late.own);
}

/**
 * Have the callee call the secret through its own CommonJS helper, in a call handed an object.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.ownHelperControl(); // { ok: true, value: "s3cret" }
 */
export async function ownHelperControl() {
	return attempt(() => self.callee.ops.ownViaHelper({}));
}

/**
 * Hand the callee a plain object and give it a `toString` while the callee waits on a timer, with two more timers due
 * in the same turn: the callee resumes inside the timer list's own run, between them.
 * @returns {Promise<object>} The outcome of the call the `toString` made.
 * @public
 * @example
 * await api.supplier.probe.laterAmongTimers(); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function laterAmongTimers() {
	const value = {};
	let outcome = null;
	const pending = self.callee.ops.convertLater(value);
	setTimeout(() => {}, 0);
	setTimeout(() => {}, 0);
	value.toString = () => {
		outcome = attempt(() => self.vault.secret.secret());
		return "x";
	};
	await pending;
	return outcome;
}

/**
 * Have the callee wait on a timer with two more timers due in the same turn, then call the secret on its own account.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.ownAmongTimers(); // { ok: true, value: "s3cret" }
 */
export async function ownAmongTimers() {
	const pending = attempt(() => self.callee.ops.secretLater());
	setTimeout(() => {}, 0);
	setTimeout(() => {}, 0);
	return pending;
}
