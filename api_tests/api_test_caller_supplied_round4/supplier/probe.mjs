/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round4/supplier/probe.mjs
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
 * @fileoverview The supplier's probes for the fourth round of caller-supplied-code tests (#597): each tries to get its
 * own code run as the callee, which may call the vault's secret, by putting it somewhere the callee runs it.
 *
 * @module api_tests/api_test_caller_supplied_round4/supplier/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a probe, settling to what it returned or the code it was refused with.
 * @param {function(): *} invoke - The probe.
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
 * Call the vault's secret, answering with the error code when refused.
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
 * A setter nested on an api object, run by the callee writing through it.
 * @returns {Promise<*>} What the setter got from the vault.
 * @public
 * @example
 * await api.supplier.probe.setterThroughCallee(); // "PERMISSION_DENIED"
 */
export async function setterThroughCallee() {
	let got = "not run";
	self.supplier.bag.box.ns = {
		set v(_value) {
			got = grab();
		}
	};
	await attempt(() => self.callee.ops.writeNested(self.supplier.bag.box, "ns", "v", 1));
	return got;
}

/**
 * A generator under `Symbol.iterator` nested on an api object, spread by the callee.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.iterableThroughCallee();
 */
export async function iterableThroughCallee() {
	self.supplier.bag.box.it = {
		*[Symbol.iterator]() {
			yield grab();
		}
	};
	return attempt(() => self.callee.ops.spreadMember(self.supplier.bag.box, "it"));
}

/**
 * A getter nested on an api object, taken from its descriptor and run by the callee.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.detachedGetterThroughCallee();
 */
export async function detachedGetterThroughCallee() {
	self.supplier.bag.box.as = {
		get value() {
			return grab();
		}
	};
	return attempt(() => self.callee.ops.detachedGetter(self.supplier.bag.box, "as", "value"));
}

/**
 * The supplier's Proxy export, read by the callee it is handed to.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.proxiedThroughCallee();
 */
export async function proxiedThroughCallee() {
	return attempt(() => self.callee.ops.read(self.supplier.bag.proxied, "x"));
}

/**
 * The supplier's function returning a function, handed to the callee to call.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.madeThroughCallee();
 */
export async function madeThroughCallee() {
	return attempt(() => self.callee.ops.call(self.supplier.bag.make()));
}

/**
 * The supplier's generator, handed to the callee to iterate.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.genThroughCallee();
 */
export async function genThroughCallee() {
	return attempt(() => self.callee.ops.spreadMember({ gen: self.supplier.bag.gen() }, "gen"));
}

/**
 * Control: the callee's own CommonJS helper, whose source is not valid UTF-8, is the callee's code in a call handed
 * an object.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.supplier.probe.ownLatinControl(); // { ok: true, value: "s3cret" }
 */
export async function ownLatinControl() {
	return attempt(() => self.callee.ops.ownViaLatin({}));
}
