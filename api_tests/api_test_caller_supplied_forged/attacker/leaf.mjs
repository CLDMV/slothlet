/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_forged/attacker/leaf.mjs
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
 * @fileoverview The attacker for the forged-placement tests (#597). A leaf called with a callback by the victim
 * runs code under a script filename naming the victim's file — the same location the victim's own frames
 * carry — so the code is placed on the victim. Placement is attribution only: the code still runs inside this
 * leaf's call, which stays its ceiling, so nothing it does may reach further than this module may itself.
 *
 * @module api_tests/api_test_caller_supplied_forged/attacker/leaf
 */

import vm from "node:vm";
import { self } from "@cldmv/slothlet/runtime";

/** Times the hook registered under the victim's placement fired. */
let fired = 0;

/** What the principal resolver registered under the victim's placement saw. */
let leaked = null;

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
 * The victim's module URL as its own frames spell it: read off this call's stack, where the victim's frame sits
 * below this leaf's, or else derived from this module's URL with the instance tag kept.
 * @returns {string} The URL.
 * @private
 */
function victimLocation() {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = 200;
	const stack = new Error().stack;
	Error.stackTraceLimit = limit;
	for (const line of String(stack).split("\n")) {
		if (!line.includes("victim/caller.mjs")) continue;
		const match = /\((.+):\d+:\d+\)\s*$/.exec(line) ?? /at (?:async )?(.+):\d+:\d+\s*$/.exec(line);
		if (match) return match[1];
	}
	const [location, query] = import.meta.url.split("?");
	const instance = /(?:^|&)(slothlet_instance=[^&]+)/.exec(query ?? "")?.[1];
	return location.replace(/attacker\/leaf\.mjs$/, "base/victim/caller.mjs") + (instance ? `?${instance}` : "");
}

/**
 * Run `source` as a script whose filename is the victim's module URL.
 * @param {string} source - Body of a function taking `(self, helpers)`.
 * @param {object} helpers - Values the body uses.
 * @returns {*} What the body returned.
 * @private
 */
function forge(source, helpers) {
	return vm.runInThisContext(`(function (self, helpers) { ${source} })`, { filename: victimLocation() })(self, helpers);
}

/**
 * Register a hook on the victim-only target, placed on the victim.
 * @returns {Promise<object>} The outcome of the registration.
 * @public
 * @example
 * await api.victim.caller.callAttacker("hookConcrete");
 */
export function hookConcrete() {
	return forge(`return helpers.attempt(() => self.slothlet.hook.on("vault.secret.secret:before", () => {}));`, { attempt });
}

/**
 * Register a hook on a glob over the victim-only target, placed on the victim: a glob is checked at fire time.
 * @returns {Promise<object>} The outcome of the registration.
 * @public
 * @example
 * await api.victim.caller.callAttacker("hookGlob");
 */
export function hookGlob() {
	return forge(`return helpers.attempt(() => self.slothlet.hook.on("vault.secret.*:before", helpers.handler));`, {
		attempt,
		handler: () => {
			fired++;
		}
	});
}

/**
 * Subscribe to an event the victim receives in full and this module may not receive, placed on the victim.
 * @returns {string} The delivery level granted.
 * @public
 * @example
 * await api.victim.caller.callAttacker("subscribe");
 */
export function subscribe() {
	return forge(`return self.slothlet.event.on("vault.leak", () => {}).level;`, {});
}

/**
 * Unregister the victim's principal, placed on the victim.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.victim.caller.callAttacker("unregisterRoles");
 */
export function unregisterRoles() {
	return forge(`return helpers.attempt(() => self.slothlet.permissions.principal.unregister("roles"));`, { attempt });
}

/**
 * Register a principal placed on the victim, whose resolver calls the victim-only target.
 * @returns {Promise<object>} The outcome of the registration.
 * @public
 * @example
 * await api.victim.caller.callAttacker("registerLeak");
 */
export function registerLeak() {
	return forge(`return helpers.attempt(() => self.slothlet.permissions.principal.register("leak", { key: () => "k", resolve: helpers.resolve }));`, {
		attempt,
		resolve: async () => {
			leaked = await attempt(() => self.vault.secret.secret());
			return {};
		}
	});
}

/**
 * Call the target whose rule requires the `leak` principal, which resolves it.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.attacker.leaf.callGate();
 */
export function callGate() {
	return attempt(() => self.vault.secret.gate());
}

/**
 * What the forged principal's resolver saw.
 * @returns {object|null} Its outcome, or null when it never ran.
 * @public
 * @example
 * api.attacker.leaf.leakedOutcome();
 */
export function leakedOutcome() {
	return leaked;
}

/**
 * How often the forged glob hook fired.
 * @returns {number} The count.
 * @public
 * @example
 * api.attacker.leaf.firedCount(); // 0
 */
export function firedCount() {
	return fired;
}
