/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_beside_self/vault/addapi.mjs
 *	@Date: 2026-10-12T12:32:02-07:00 (1791833522)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T13:04:20-07:00 (1791835460)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a class-instance addapi default with a named export, whose prototype method reads a private field.
 * @module api_smart_flatten_addapi_beside_self.vault.addapi
 */

class Vault {
	#secret = "secret";

	reveal() {
		return this.#secret;
	}
}

export default new Vault();

export const extra = "extra";
