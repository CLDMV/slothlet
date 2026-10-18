/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/supplier/probe.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier for the caller-supplied-code tests (#597). Every leaf hands the callee a value
 * carrying its own code — a `toString`, a getter, a Proxy trap, a callback — and that code calls the vault.
 * Nothing allows this module to read `vault.secret.secret`, so each attempt must be refused exactly as a
 * direct call is, and `vault.secret.whoami` must name this module.
 *
 * Each attempt is started synchronously inside the supplied code, so it runs while the callee's call is
 * executing, and its outcome is settled afterwards.
 *
 * @module api_tests/api_test_caller_supplied_code/supplier/probe
 */

import { self } from "@cldmv/slothlet/runtime";

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
 * Pick the vault leaf a probe calls.
 * @param {"secret"|"whoami"} target - Which vault leaf.
 * @returns {function(): *} A thunk calling it through `self`.
 * @private
 */
function vaultCall(target) {
	return target === "whoami" ? () => self.vault.secret.whoami() : () => self.vault.secret.secret();
}

/**
 * Call the vault directly, as this module.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.direct(); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function direct(target = "secret") {
	return attempt(vaultCall(target));
}

/**
 * The issue's repro: a `toString` the callee runs with `String(v)`.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome of the call made inside `toString`.
 * @public
 * @example
 * await api.supplier.probe.viaToString();
 */
export async function viaToString(target = "secret") {
	let outcome;
	await self.callee.ops.echo({
		toString() {
			outcome = attempt(vaultCall(target));
			return "x";
		}
	});
	return outcome;
}

/**
 * A `toString` the callee runs through a template literal.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaTemplate();
 */
export async function viaTemplate(target = "secret") {
	let outcome;
	await self.callee.ops.template({
		toString() {
			outcome = attempt(vaultCall(target));
			return "x";
		}
	});
	return outcome;
}

/**
 * A `valueOf` the callee runs with `+v`.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaValueOf();
 */
export async function viaValueOf(target = "secret") {
	let outcome;
	await self.callee.ops.num({
		valueOf() {
			outcome = attempt(vaultCall(target));
			return 1;
		}
	});
	return outcome;
}

/**
 * A `Symbol.toPrimitive` the callee runs with `+v`.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaToPrimitive();
 */
export async function viaToPrimitive(target = "secret") {
	let outcome;
	await self.callee.ops.num({
		[Symbol.toPrimitive]() {
			outcome = attempt(vaultCall(target));
			return 1;
		}
	});
	return outcome;
}

/**
 * A `toJSON` the callee runs with `JSON.stringify`.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaToJSON();
 */
export async function viaToJSON(target = "secret") {
	let outcome;
	await self.callee.ops.json({
		toJSON() {
			outcome = attempt(vaultCall(target));
			return "x";
		}
	});
	return outcome;
}

/**
 * An accessor property the callee reads.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaGetter();
 */
export async function viaGetter(target = "secret") {
	let outcome;
	await self.callee.ops.read(
		{
			get value() {
				outcome = attempt(vaultCall(target));
				return 1;
			}
		},
		"value"
	);
	return outcome;
}

/**
 * A Proxy whose `get` trap runs when the callee reads a property.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaProxyGet();
 */
export async function viaProxyGet(target = "secret") {
	let outcome;
	const value = new Proxy(
		{},
		{
			get(object, key) {
				// Only the key the callee reads runs the supplier's code; every other key (a framework's own
				// probes, such as a conversion) reads as from the plain target.
				if (key !== "anything") return Reflect.get(object, key);
				outcome = attempt(vaultCall(target));
				return 1;
			}
		}
	);
	await self.callee.ops.read(value, "anything");
	return outcome;
}

/**
 * A Proxy whose `has` trap runs when the callee tests a property with `in`.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaProxyHas();
 */
export async function viaProxyHas(target = "secret") {
	let outcome;
	const value = new Proxy(
		{},
		{
			has(object, key) {
				if (key !== "anything") return Reflect.has(object, key);
				outcome = attempt(vaultCall(target));
				return true;
			}
		}
	);
	await self.callee.ops.has(value, "anything");
	return outcome;
}

/**
 * A callback the callee calls synchronously.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaCallback();
 */
export async function viaCallback(target = "secret") {
	let outcome;
	await self.callee.ops.run(() => {
		outcome = attempt(vaultCall(target));
		return 1;
	});
	return outcome;
}

/**
 * A callback the callee calls after an `await` of its own, still inside its call.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaCallbackAfterAwait();
 */
export async function viaCallbackAfterAwait(target = "secret") {
	let outcome;
	await self.callee.ops.runAfterAwait(() => {
		outcome = attempt(vaultCall(target));
		return 1;
	});
	return outcome;
}

/**
 * Ask the callee to read the vault on its own account. The deputy keeps its own rights.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.viaDeputy(); // { ok: true, value: "s3cret" }
 */
export async function viaDeputy() {
	return attempt(() => self.callee.ops.useSecret());
}
