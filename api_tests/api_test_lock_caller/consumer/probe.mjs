/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller/consumer/probe.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 09:38:51 -07:00 (1779122331)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Consumer module (module "B") for the lockCaller/bind repro.
 *
 * @description
 * Builds callbacks that probe slothlet's caller identity. The `make*` factories run
 * as consumer-module code, so `self.slothlet.lockCaller()` called inside them
 * captures the consumer module's identity. The plain (un-pinned) variants exist for
 * comparison — they inherit whatever async context is ambient when invoked.
 *
 * @module api_tests/api_test_lock_caller/consumer/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Reflect the caller identity slothlet currently attributes to this code.
 * Probes identity-marker permission rules: a `deny` rule keyed to `consumer.**`
 * (resp. `producer.**`) only bites when the active caller is that module.
 * @returns {string} `"consumer"`, `"producer"`, or `"unknown"`.
 * @internal
 */
function identityProbe() {
	if (self.slothlet.permissions.self.access("id.consumer") === false) return "consumer";
	if (self.slothlet.permissions.self.access("id.producer") === false) return "producer";
	return "unknown";
}

/**
 * Call a permission-gated module route. Succeeds only when the active caller is
 * permitted to reach `consumer.probe.guarded`.
 * @returns {string} The guarded route's result.
 * @internal
 */
function guardedCall() {
	return self.consumer.probe.guarded();
}

/**
 * Read the live request-scoped context.
 * @param {string} [key] - Optional context key.
 * @returns {*} Context value or full context object.
 * @internal
 */
function readContext(key) {
	return self.slothlet.context.get(key);
}

/**
 * Permission-gated target route used by {@link guardedCall}.
 * @returns {string} A constant marker value.
 * @public
 * @example
 * api.consumer.probe.guarded();
 */
export const guarded = () => "guarded-ok";

/**
 * Build an identity probe with the consumer module's caller identity pinned.
 * @returns {Function} A `lockCaller`-wrapped probe.
 * @public
 * @example
 * const probe = api.consumer.probe.makeLockedIdentityProbe();
 */
export function makeLockedIdentityProbe() {
	return self.slothlet.lockCaller(identityProbe);
}

/**
 * Build an identity probe with no caller pinning (inherits ambient identity).
 * @returns {Function} The bare probe function.
 * @public
 */
export function makePlainIdentityProbe() {
	return identityProbe;
}

/**
 * Build a guarded-route caller with the consumer module's identity pinned.
 * @returns {Function} A `lockCaller`-wrapped guarded caller.
 * @public
 */
export function makeLockedGuardedCall() {
	return self.slothlet.lockCaller(guardedCall);
}

/**
 * Build a guarded-route caller with no caller pinning.
 * @returns {Function} The bare guarded caller.
 * @public
 */
export function makePlainGuardedCall() {
	return guardedCall;
}

/**
 * Build a context reader with the consumer module's identity pinned.
 * @returns {Function} A `lockCaller`-wrapped context reader.
 * @public
 */
export function makeLockedContextReader() {
	return self.slothlet.lockCaller(readContext);
}

/**
 * Build a `lockCaller`-wrapped callback that returns its own `this` binding.
 * @returns {Function} A `lockCaller`-wrapped `this` probe.
 * @public
 */
export function makeLockedThisProbe() {
	return self.slothlet.lockCaller(function thisProbe() {
		return this;
	});
}

/**
 * Build a `bind`-wrapped callback (full async-context freeze) from `fn`.
 * @param {Function} fn - Callback to bind.
 * @returns {Function} An `AsyncResource.bind`-wrapped callback.
 * @public
 */
export function makeBound(fn) {
	return self.slothlet.bind(fn);
}
