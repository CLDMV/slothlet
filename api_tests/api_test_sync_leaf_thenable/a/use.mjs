/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_sync_leaf_thenable/a/use.mjs
 *	@Date: 2026-11-03T04:45:11-08:00 (1793709911)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T05:23:26-08:00 (1793712206)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module `a` for the sync-leaf-thenable tests (#599): the only module allowed to call
 * `c.vault.secret`. It awaits `b`'s leaves, and `b`'s thenables must not borrow its rights.
 *
 * @module api_tests/api_test_sync_leaf_thenable/a/use
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Await a `b.give` leaf, as the issue's repro does.
 * @param {string} leaf - Which `b.give` leaf.
 * @param {...*} args - Its arguments.
 * @returns {Promise<*>} What awaiting its result produced.
 * @public
 * @example
 * await api.a.use.give("syncThen", "whoami"); // { ok: true, value: "b.give.syncThen" }
 */
export async function give(leaf, ...args) {
	return await self.b.give[leaf](...args);
}

/**
 * Call the vault directly, as this module.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<*>} The vault's answer.
 * @public
 * @example
 * await api.a.use.direct(); // "s3cret"
 */
export async function direct(target = "secret") {
	return target === "whoami" ? self.c.vault.whoami() : self.c.vault.secret();
}

/**
 * Run a function another module handed out, inside this module's own call.
 * @param {Function} fn - The function.
 * @param {...*} args - Its arguments.
 * @returns {Promise<*>} What it returned.
 * @public
 * @example
 * await api.a.use.run(await api.b.give.helper(), "whoami");
 */
export async function run(fn, ...args) {
	return await fn(...args);
}

/**
 * The reverse case (#597): hand `b` a thenable of this module's own, which `b` awaits. Its code is this
 * module's and keeps this module's rights.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {Promise<*>} The outcome of the call made inside `then`.
 * @public
 * @example
 * await api.a.use.supply(); // { ok: true, value: "s3cret" }
 */
export async function supply(target = "secret") {
	let outcome;
	await self.b.take.awaitIt({
		then(resolve) {
			try {
				outcome = Promise.resolve(target === "whoami" ? self.c.vault.whoami() : self.c.vault.secret()).then(
					(value) => ({ ok: true, value }),
					(error) => ({ ok: false, code: error?.code ?? String(error) })
				);
			} catch (error) {
				outcome = { ok: false, code: error?.code ?? String(error) };
			}
			resolve();
		}
	});
	return outcome;
}

/**
 * Await a `b.give` leaf that fails, and report only that it failed, without reading the error.
 * @param {string} leaf - Which `b.give` leaf.
 * @param {...*} args - Its arguments.
 * @returns {Promise<boolean>} True when it threw or rejected.
 * @public
 * @example
 * await api.a.use.fails("failWithGetter"); // true
 */
export async function fails(leaf, ...args) {
	try {
		await self.b.give[leaf](...args);
		return false;
	} catch {
		return true;
	}
}
