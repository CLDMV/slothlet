/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-deep-recursion.test.vitest.mjs
 *	@Date: 2026-11-12T23:14:59-08:00 (1794554099)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:28:42-08:00 (1794554922)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An access made from the bottom of a deep recursion is held to the code that started it: when the
 * frames nearest the access place nothing and the stack goes on, the live runtime reads the stack further out before
 * it answers, so a module's waiting call is still held to the module's rules, and the host still answers as the host.
 *
 * @description
 * Fixture `api_test_deep_recursion`. After an `await`, `sup` has a package (`deep-walker`, which no instance file is)
 * call the vault's node as a callback from `depth` frames of the package's own, and does the same from `depth` frames
 * of its own file. The host recurses in this test file and calls the vault while a call of `sup` is waiting. The
 * instances run with `permissions.references.capture: false`, so a node read out of `self` is attributed where it is
 * called, not where it was read.
 *
 * Expected values come from the rule (PERMISSIONS.md, "Overlapping calls" and the definer rule): code runs with the
 * rights of the module whose call it runs inside, however many frames of someone else's are between the access and
 * that call, and the host's own code is never refused by a rule. The async runtime knows the call from its store and
 * is the reference for the live runtime at every depth it reads. Past the depth the live runtime reads to, nothing
 * says whose access it is, and it is refused for anyone while a call is waiting.
 * @module tests/vitests/suites/permissions/permissions-deep-recursion
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_deep_recursion/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** Depths short of, and past, the 50 frames the live runtime reads first; all short of the 1024 it reads to. */
const DEPTHS = [5, 60, 600];
/** A depth past the frames the live runtime reads to. */
const TOO_DEEP = 1100;

const RULE_SETS = [
	{ label: "sup denied the vault", rules: [{ caller: "sup.**", target: "vault.**", effect: "deny" }], sup: DENIED },
	{ label: "nothing denied", rules: [], sup: SECRET }
];

/**
 * The host's own recursion: call `callback` from `depth` frames of this function.
 * @param {number} depth - How many times to recurse first.
 * @param {Function} callback - What to call at the bottom.
 * @returns {*} What the callback returns.
 */
function hostDescend(depth, callback) {
	return depth > 0 ? hostDescend(depth - 1, callback) : callback();
}

/**
 * Give back what a function returns, or the code of the error it threw.
 * @param {Function} run - The function.
 * @returns {*} The outcome.
 */
function attempt(run) {
	try {
		return run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

describe.each(matrix)(
	"an access from the bottom of a deep recursion > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		describe.each(RULE_SETS)("$label", ({ rules, sup }) => {
			let api;

			afterEach(async () => {
				await api?.shutdown?.();
				api = null;
			});

			/**
			 * Build the instance.
			 * @returns {Promise<void>}
			 */
			async function open() {
				// `references.capture: false`: the vault's node read out of `self` carries no reader of its own, so the call is
				// attributed where it is made, from the stack.
				api = await slothlet({
					base: BASE,
					mode,
					runtime,
					silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules, references: { capture: false } }
				});
				await api.vault;
				await api.sup;
			}

			it.each(DEPTHS)(`sup's waiting call answers ${sup} from %i frames of a package's own`, async (depth) => {
				await open();
				expect(await api.sup.viaPackage(depth)).toBe(sup);
			});

			it.each(DEPTHS)(`sup's waiting call answers ${sup} from %i frames of its own file`, async (depth) => {
				await open();
				expect(await api.sup.own(depth)).toBe(sup);
			});

			it.each(DEPTHS)("the host reads the vault from %i frames of its own while a call of sup is waiting", async (depth) => {
				await open();
				let release;
				const waiting = api.sup.wait(new Promise((resolve) => (release = resolve)));
				try {
					expect(attempt(() => hostDescend(depth, () => api.vault.get()))).toBe(SECRET);
				} finally {
					release();
					await waiting;
				}
			});

			it("past the depth the live runtime reads to, the access is refused for anyone while a call is waiting", async () => {
				await open();
				// The async runtime reads no stack to know the call: it answers as at any other depth.
				expect(await api.sup.viaPackage(TOO_DEEP)).toBe(runtime === "live" ? DENIED : sup);
				let release;
				const waiting = api.sup.wait(new Promise((resolve) => (release = resolve)));
				try {
					expect(attempt(() => hostDescend(TOO_DEEP, () => api.vault.get()))).toBe(runtime === "live" ? DENIED : SECRET);
				} finally {
					release();
					await waiting;
				}
			});
		});
	}
);
