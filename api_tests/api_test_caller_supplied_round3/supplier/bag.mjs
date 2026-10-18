/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/supplier/bag.mjs
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
 * @fileoverview Objects of the supplier's exported onto the api (#597): code in them — an iterator, a function under a
 * symbol, an accessor defined or assigned at runtime — is the supplier's, whoever runs it.
 *
 * @module api_tests/api_test_caller_supplied_round3/supplier/bag
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the vault's secret, reporting the outcome as a value.
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
 * An iterable whose iterator calls the vault's secret.
 * @type {Iterable<string>}
 * @public
 * @example
 * [...api.supplier.bag.iter]; // ["PERMISSION_DENIED"]
 */
export const iter = {
	*[Symbol.iterator]() {
		yield grab();
	}
};

/**
 * An object holding a function under a registered symbol that calls the vault's secret.
 * @type {object}
 * @public
 * @example
 * api.supplier.bag.symbolic[Symbol.for("round3.grab")](); // "PERMISSION_DENIED"
 */
export const symbolic = {
	[Symbol.for("round3.grab")]() {
		return grab();
	}
};

/**
 * An object accessors are put on at runtime.
 * @type {object}
 * @public
 * @example
 * api.supplier.bag.late; // {}
 */
export const late = {
	marker: 1
};
