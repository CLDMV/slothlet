/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-live-parked-flow.test.vitest.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T08:00:00-08:00 (1794672000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A flow a module starts stays held to that module whoever awaits it later, in both runtimes.
 *
 * @description
 * Fixture `api_test_live_parked_flow`. `a` gets `alpha`'s async function (a helper file's, which reads the vault once a
 * gate the host holds opens), returned as it is or nested in plain data, starts it in its own call and leaves the
 * promise for the host: on `globalThis`, on an object the host passed in, in a list the host takes through the api, in
 * an event payload, or as the value of another promise. The host's own code awaits it before the gate opens.
 *
 * The rule (round-6 ruling on flows a module starts): the flow is the module's that started it, whoever awaits it, so
 * with `a` denied the vault every parked row is refused, as the async runtime's store already has it. The host starting
 * the function itself and awaiting it is the host's flow and answers `"SECRET"` (PERMISSIONS.md, "A flow no call waits
 * for"); `a` returning the promise through its own call's value is `a`'s call, refused, and while that call waits the
 * live runtime refuses code no waiting call accounts for whatever the rules.
 * @module tests/vitests/suites/permissions/permissions-live-parked-flow
 */

import path from "node:path";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_live_parked_flow/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [false, true].map((boxed) => ({ mode, runtime, attribution, boxed })))
	)
);

/**
 * Await a promise, reporting a refusal by its code.
 * @param {*} value - The promise.
 * @returns {Promise<*>} What it resolved to, or the code of the error.
 */
async function settle(value) {
	try {
		return await value;
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Run a row: set the gate, have the flow started, attach the host's await, then open the gate.
 * @param {function(object): *} start - Starts the flow; gets a scratch object.
 * @param {function(object): *} wait - The host's awaiting expression.
 * @returns {Promise<*>} What the host's await gave.
 */
async function row(start, wait) {
	let open;
	globalThis.__parkedFlowGate = new Promise((resolve) => (open = resolve));
	const scratch = {};
	await settle(start(scratch));
	const pending = settle(wait(scratch));
	await null;
	open();
	return pending;
}

/** The parked rows: how `a` leaves the promise, and how the host awaits it. */
const PARKED = [
	{ name: "parked on globalThis", start: (api) => api.a.park("global"), wait: () => globalThis.__parkedFlow },
	{ name: "parked on the host's object", start: (api, s) => api.a.park("object", (s.target = {})), wait: (s) => s.target.promise },
	{
		name: "taken from a module's list through the api",
		start: (api) => api.a.park("list"),
		wait: async (s, api) => (await api.a.take()).promise
	},
	{
		name: "sent as an event payload",
		start: (api, s) => {
			s.emitter = new EventEmitter();
			s.emitter.on("parked", (promise) => (s.got = promise));
			return api.a.park("event", s.emitter);
		},
		wait: (s) => s.got
	},
	{
		name: "the value of another promise",
		start: (api) => api.a.park("resolved"),
		wait: async () => (await globalThis.__parkedFlow).promise
	},
	{
		name: "handed on to another module that awaits it",
		start: (api) => api.a.park("global"),
		wait: (s, api) => api.w.wait(globalThis.__parkedFlow)
	},
	{
		name: "under Promise.all",
		start: (api) => api.a.park("global"),
		wait: () => Promise.all([globalThis.__parkedFlow]).then(([value]) => value)
	},
	{ name: "under Promise.race", start: (api) => api.a.park("global"), wait: () => Promise.race([globalThis.__parkedFlow]) },
	{ name: "under a then chain", start: (api) => api.a.park("global"), wait: () => globalThis.__parkedFlow.then((value) => value) },
	{
		name: "under for await",
		start: (api) => api.a.park("global"),
		wait: async () => {
			let last;
			for await (const value of [globalThis.__parkedFlow]) last = value;
			return last;
		}
	},
	{
		name: "under a thenable",
		start: (api) => api.a.park("global"),
		wait: () => ({ then: (resolve, reject) => globalThis.__parkedFlow.then(resolve, reject) })
	}
];

describe.each(MATRIX)(
	"a flow a module starts and parks > $mode / $runtime / $attribution / boxed $boxed",
	({ mode, runtime, attribution, boxed }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			delete globalThis.__parkedFlow;
			delete globalThis.__parkedFlowGate;
		});

		/**
		 * Build the instance and have `a` get the function.
		 * @param {object[]} rules - The rules.
		 * @returns {Promise<void>}
		 */
		async function open(rules) {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
			await api.a.start(boxed);
		}

		for (const [label, rules, answer] of [
			["a denied", [{ caller: "a.**", target: "vault.**", effect: "deny" }], DENIED],
			["nothing denied", [], SECRET]
		]) {
			it.each(PARKED)(`with ${label}, $name answers ${answer}`, async ({ start, wait }) => {
				await open(rules);
				expect(
					await row(
						(s) => start(api, s),
						(s) => wait(s, api)
					)
				).toBe(answer);
			});

			// While a's call waits on the promise it returned, the live runtime refuses code no waiting call accounts for
			// whatever the rules (PERMISSIONS.md, "Overlapping calls"), except where the function is a stand-in whose call a
			// made, as `permissions-live-detached-flow` has it for `d.detach` while `w.hold` waits.
			const whileWaiting = runtime === "live" && (attribution === "fast" || boxed) ? DENIED : answer;
			it(`with ${label}, a returning the promise through its call answers ${whileWaiting}`, async () => {
				await open(rules);
				expect(
					await row(
						() => null,
						() => api.a.give()
					)
				).toBe(whileWaiting);
			});

			it(`with ${label}, the host starting the function itself and awaiting it answers SECRET`, async () => {
				await open(rules);
				expect(
					await row(
						async (s) => (s.fn = boxed ? (await api.alpha.box()).run : await api.alpha.giveLater()),
						(s) => s.fn()
					)
				).toBe(SECRET);
			});
		}
	}
);
