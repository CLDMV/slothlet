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
 * Build a `lockCaller`-wrapped async callback that awaits a microtask before probing identity.
 * Used to test whether caller identity survives an `await` inside the locked callback
 * (it does in async runtime mode; live runtime mode only covers the synchronous portion).
 * @returns {Function} A `lockCaller`-wrapped async probe.
 * @public
 */
export function makeLockedAsyncIdentityProbe() {
	return self.slothlet.lockCaller(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		return identityProbe();
	});
}

/**
 * Build a `bind`-wrapped identity probe (full async-context freeze).
 * Used to verify that `bind`, registered as consumer code, carries the consumer's
 * slothlet caller identity when invoked later from another module.
 * @returns {Function} A `bind`-wrapped identity probe.
 * @public
 */
export function makeBoundIdentityProbe() {
	return self.slothlet.bind(identityProbe);
}

// ─── Hook auto-pin probes ──────────────────────────────────────────────────

/**
 * Caller identity observed by the most recent {@link identityHook} invocation.
 * @type {string|null}
 */
let hookProbedIdentity = null;

/**
 * Shared `before`-hook handler: probes the caller identity slothlet attributes to
 * it and stashes the result for {@link getHookProbedIdentity} to read back.
 *
 * A pinned hook (the default) runs with a slothlet context, so `identityProbe()`
 * resolves. An opted-out (`lockCaller: false`) hook may run with no context — in
 * async runtime a `self.*` access then throws; the error code is stashed instead
 * so the call does not reject and the opt-out is still observable.
 * @returns {void}
 * @internal
 */
function identityHook() {
	try {
		hookProbedIdentity = identityProbe();
	} catch (err) {
		hookProbedIdentity = err?.code ?? "error";
	}
}

/**
 * Register {@link identityHook} as a `before` hook on `pattern`. Runs as consumer
 * module code, so the hook manager pins the consumer's caller identity onto the
 * handler unless `options` opts out with `{ lockCaller: false }`.
 * @param {string} pattern - API path pattern to hook (without the `before:` prefix).
 * @param {object} [options] - Hook options forwarded to `hook.on`.
 * @returns {string} The registered hook ID.
 * @public
 */
export function registerIdentityHook(pattern, options) {
	hookProbedIdentity = null;
	return self.slothlet.hook.on(`before:${pattern}`, identityHook, options);
}

/**
 * Register an already `lockCaller`-wrapped {@link identityHook} as a `before` hook.
 * The hook manager must respect the existing lock and not double-wrap it.
 * @param {string} pattern - API path pattern to hook (without the `before:` prefix).
 * @returns {string} The registered hook ID.
 * @public
 */
export function registerPreLockedHook(pattern) {
	hookProbedIdentity = null;
	return self.slothlet.hook.on(`before:${pattern}`, self.slothlet.lockCaller(identityHook));
}

/**
 * Read back the caller identity the most recent hook invocation observed.
 * @returns {string|null} `"consumer"`, `"producer"`, `"unknown"`, or `null` if the
 *   hook never fired.
 * @public
 */
export function getHookProbedIdentity() {
	return hookProbedIdentity;
}
