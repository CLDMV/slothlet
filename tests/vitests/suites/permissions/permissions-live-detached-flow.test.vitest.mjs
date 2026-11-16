/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-live-detached-flow.test.vitest.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An async flow a module starts and lets go of is held to the same rules in both runtimes.
 *
 * @description
 * `d` gets `alpha`'s async function (a helper file's, which reads the vault after an `await`), returned as it is or
 * nested in plain data, and starts it in its own call. In the async runtime the function's flow carries `d`'s call
 * however long it runs, so `d`'s rules hold it. The live runtime holds the same flow to the same rules when it picks up
 * with no call waiting, as it does while calls wait: code of the instance that picks up after an `await` with no
 * waiting call to account for it is held to every module of the instance, as well as to its definer.
 *
 * Rules `deny d.** -> vault.**`:
 *
 * | Route                                                      | Both runtimes        |
 * | ---------------------------------------------------------- | -------------------- |
 * | `d.direct`: `d` awaits the function in its call             | `PERMISSION_DENIED`  |
 * | `d.detach`: a function of `d`'s file awaits it, `d` returns | `PERMISSION_DENIED`  |
 * | `d.detach` while `w.hold` waits                             | `PERMISSION_DENIED`  |
 * | `d.raw`: no one awaits it, `d` returns                      | `PERMISSION_DENIED`  |
 * | `d.viaW`: `w` awaits it                                     | `PERMISSION_DENIED`  |
 *
 * With nothing denied every route answers `"SECRET"` in both runtimes, but for one route the live runtime refused
 * before: while a call waits, code no waiting call accounts for is refused whatever the rules. The host running the
 * function itself and awaiting it answers `"SECRET"` in both runtimes, whatever is denied: its own code awaiting the
 * flow says the flow is the host's. The host starting it with no flow of its own awaiting it answers `"SECRET"` on the
 * async runtime, which knows the host started it. The live runtime knows that too when the function is a stand-in
 * ("precise", the function returned as it is): the call is the stand-in's. Otherwise it cannot tell the host's flow
 * from one a module let go of, and refuses while some module is denied (PERMISSIONS.md, "A flow no call waits for").
 * @module tests/vitests/suites/permissions/permissions-live-detached-flow
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_live_detached_flow/api");
const DENIED = "PERMISSION_DENIED";
const D_DENIED = [{ caller: "d.**", target: "vault.**", effect: "deny" }];

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [false, true].map((boxed) => ({ mode, runtime, attribution, boxed })))
	)
);

/**
 * Run code from the host, reporting a refusal by its code.
 * @param {function(): *} run - The code.
 * @returns {Promise<*>} What it answered, or the code of the error.
 */
async function attempt(run) {
	try {
		return await run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

describe.each(matrix)(
	"a flow a module lets go of > $mode / $runtime / $attribution / boxed $boxed",
	({ mode, runtime, attribution, boxed }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance and have `d` get the function.
		 * @param {object[]} rules - The rules.
		 * @returns {Promise<void>}
		 */
		async function open(rules) {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
			await api.d.start(boxed);
		}

		/**
		 * Every route, in the table's order.
		 * @returns {Promise<Array<*>>} What each answered.
		 */
		async function routes() {
			const answers = [await api.d.direct()];
			await api.d.detach();
			answers.push(await api.d.outcome());
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const held = api.w.hold(gate);
			await api.d.detach();
			answers.push(await api.d.outcome());
			release();
			await held;
			await api.d.raw();
			answers.push(await api.d.outcome());
			answers.push(await api.d.viaW());
			return answers;
		}

		/**
		 * The host gets the function itself and runs it.
		 * @returns {Promise<*>} What it answered.
		 */
		async function hostRuns() {
			const fn = boxed ? (await api.alpha.box()).run : await api.alpha.giveLater();
			return attempt(() => fn());
		}

		it("with d denied the vault, every route d starts is refused", async () => {
			await open(D_DENIED);
			expect(await routes()).toEqual([DENIED, DENIED, DENIED, DENIED, DENIED]);
		});

		it("with nothing denied, every route answers", async () => {
			await open([]);
			// While a call waits, the live runtime refuses code no waiting call accounts for whatever the rules (PERMISSIONS.md,
			// "Overlapping calls"): `d.detach` while `w.hold` waits, except where the function is a stand-in whose call d made.
			const whileWaiting = runtime === "live" && (attribution === "fast" || boxed) ? DENIED : "SECRET";
			expect(await routes()).toEqual(["SECRET", "SECRET", whileWaiting, "SECRET", "SECRET"]);
		});

		it("with nothing denied, the host running the function itself answers", async () => {
			await open([]);
			expect(await hostRuns()).toBe("SECRET");
		});

		it("with d denied, the host running the function itself and awaiting it answers", async () => {
			await open(D_DENIED);
			expect(await hostRuns()).toBe("SECRET");
		});

		it("with d denied, the host starting the function and letting go of it answers as the async runtime does where the live runtime can tell", async () => {
			await open(D_DENIED);
			const fn = boxed ? (await api.alpha.box()).run : await api.alpha.giveLater();
			let outcome;
			// No flow of the host's awaits the function: the live runtime cannot tell it from a flow a module let go of.
			fn().then(
				(value) => (outcome = value),
				(error) => (outcome = error.code ?? error.name)
			);
			await new Promise((resolve) => setTimeout(resolve, 5));
			const told = runtime === "async" || (attribution === "precise" && !boxed);
			expect(outcome).toBe(told ? "SECRET" : DENIED);
		});
	}
);
