/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_sync_leaf_thenable/d/maker.mjs
 *	@Date: 2026-11-03T04:44:33-08:00 (1793709873)
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
 * @fileoverview Module `d` for the sync-leaf-thenable tests (#599): a synchronous leaf another module calls
 * and hands on, whose thenable calls the vault.
 *
 * @module api_tests/api_test_sync_leaf_thenable/d/maker
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Return a thenable whose `then` calls the vault.
 * @param {"secret"|"whoami"} [target="secret"] - Which vault leaf.
 * @returns {{then: function}} A thenable resolving to the outcome.
 * @public
 * @example
 * await api.d.maker.make("whoami"); // { ok: true, value: "d.maker.make" }
 */
export function make(target = "secret") {
	return {
		then(resolve) {
			try {
				const result = target === "whoami" ? self.c.vault.whoami() : self.c.vault.secret();
				resolve(
					Promise.resolve(result).then(
						(value) => ({ ok: true, value }),
						(error) => ({ ok: false, code: error?.code ?? String(error) })
					)
				);
			} catch (error) {
				resolve({ ok: false, code: error?.code ?? String(error) });
			}
		}
	};
}
