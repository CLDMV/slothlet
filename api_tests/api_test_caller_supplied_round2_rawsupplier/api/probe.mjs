/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_caller_supplied_round2_rawsupplier/api/probe.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:38-08:00 (1795868858)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A supplier for the second round of caller-supplied-code tests (#597) that imports the holder's leaf
 * file to hand the holder its own function raw. Module code may not import a leaf file, so this file's load is
 * refused with MODULE_LEAF_IMPORT_REFUSED and none of its functions runs.
 *
 * @module api_tests/api_test_caller_supplied_round2_rawsupplier/api/probe
 */

import { self } from "@cldmv/slothlet/runtime";
import { useSecret } from "../../api_test_caller_supplied_round2/api/holder/ops.mjs";

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
 * Hand the holder its own leaf function, imported raw from its file, for it to call.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.rawsupplier.probe.rawLeafHanded();
 */
export async function rawLeafHanded() {
	return attempt(() => self.holder.ops.run(useSecret));
}

/**
 * Hand the holder its own leaf function, imported raw from its file, inside a plain options object.
 * @param {boolean} [frozen=false] - Whether the options object is frozen.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.rawsupplier.probe.rawLeafInOptions();
 */
export async function rawLeafInOptions(frozen = false) {
	const options = { fn: useSecret };
	return attempt(() => self.holder.ops.runIn(frozen ? Object.freeze(options) : options));
}

/**
 * Hand the holder a closure of the supplier's that calls the holder's own leaf function, imported raw.
 * @returns {Promise<object>} The outcome.
 * @public
 * @example
 * await api.rawsupplier.probe.rawLeafInClosure();
 */
export async function rawLeafInClosure() {
	return attempt(() => self.holder.ops.run(() => useSecret()));
}
