/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_ceiling/supplier/probe.mjs
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
 * @fileoverview The supplier for the ceiling tests (#597). Each leaf hands the callee a `toString` that takes an
 * identity — a pin, a captured reference, a scope, a relay's `lockCaller.caller` — and uses it once the callee
 * has returned, or reads data inside the callee's call. Code the supplier hands the callee runs as the supplier
 * with the callee as its ceiling, so each use must be refused where either of the two is.
 *
 * @module api_tests/api_test_caller_supplied_ceiling/supplier/probe
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
 * Hand the callee a value whose `toString` runs `inside`, and return what `inside` returned.
 * @param {function(): *} inside - Code to run inside the callee's call.
 * @returns {Promise<*>} What `inside` returned.
 * @private
 */
async function handOver(inside) {
	let result;
	await self.callee.ops.echo({
		toString() {
			result = inside();
			return "x";
		}
	});
	return result;
}

/**
 * Call the supplier's own target directly.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.direct(); // { ok: true, value: "supplied" }
 */
export async function direct() {
	return attempt(() => self.vault.secret.forSupplier());
}

/**
 * Read the supplier's own data directly.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.readDirect(); // { ok: true, value: 3 }
 */
export async function readDirect() {
	return attempt(async () => await self.vault.data.level);
}

/**
 * Call the supplier's own target from code run inside the callee: the callee is not allowed it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.ceilingCall();
 */
export async function ceilingCall() {
	return handOver(() => attempt(() => self.vault.secret.forSupplier()));
}

/**
 * Read the supplier's own data from code run inside the callee.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.ceilingRead();
 */
export async function ceilingRead() {
	return handOver(() => attempt(async () => await self.vault.data.level));
}

/**
 * Report the identity seen inside the callee's call.
 * @returns {Promise<string|null>} The api path `metadata.self()` reports there.
 * @public
 * @example
 * await api.supplier.probe.selfInside(); // "supplier.probe.selfInside"
 */
export async function selfInside() {
	return handOver(() => self.slothlet.metadata.self()?.apiPath ?? null);
}

/**
 * Pin a callback with `lockCaller` inside the callee's call and run it after the callee has returned.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.pinnedInside();
 */
export async function pinnedInside() {
	const pinned = await handOver(() => self.slothlet.lockCaller(() => self.vault.secret.forSupplier()));
	return attempt(() => pinned());
}

/**
 * Take a reference to the supplier's own target inside the callee's call and call it afterwards.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.capturedInside();
 */
export async function capturedInside() {
	// Held in an object: returned bare from an async function, a lazy chain's reference would be adopted as a
	// thenable and resolved, and the reference itself is what is being tested.
	const { reference } = await handOver(() => ({ reference: self.vault.secret.forSupplier }));
	return attempt(() => reference());
}

/**
 * Open a scope inside the callee's call and call the callee's own target from it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.scopeInside();
 */
export async function scopeInside() {
	return handOver(() => self.slothlet.run({}, () => attempt(() => self.vault.secret.secret())));
}

/**
 * Hand the relay a callback from inside the callee's call; the relay runs it later as its caller.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.relayInside();
 */
export async function relayInside() {
	return handOver(() => self.relay.queue.later(() => self.vault.secret.forSupplier()));
}

/**
 * Hand the relay the same callback directly, as the supplier: the relay runs it as the supplier.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.relayDirect(); // { ok: true, value: "supplied" }
 */
export async function relayDirect() {
	return self.relay.queue.later(() => self.vault.secret.forSupplier());
}
