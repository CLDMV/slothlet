/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/supplier/ctor.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class and a constructor function the supplier exports (#597): whoever constructs them, their bodies
 * are the supplier's code.
 *
 * @module api_tests/api_test_caller_supplied_round5/supplier/ctor
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the vault's secret, answering with the error code when refused.
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
 * A class whose constructor calls the vault.
 * @public
 * @example
 * new api.supplier.ctor.Named().v; // "PERMISSION_DENIED"
 */
export class Named {
	constructor() {
		this.v = grab();
	}
}

/**
 * A constructor function that calls the vault.
 * @public
 * @example
 * new api.supplier.ctor.Fn().v; // "PERMISSION_DENIED"
 */
export function Fn() {
	this.v = grab();
}
