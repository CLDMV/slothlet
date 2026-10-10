/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_instance_default/vault/addapi.mjs
 *	@Date: 2026-10-10T09:44:09-07:00 (1791650649)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T09:44:09-07:00 (1791650649)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi class-instance default whose constructor assigns a
 * method that reads a private field, plus a named export.
 * @module smart_flatten.api_smart_flatten_instance_default.vault.addapi
 */

/**
 * A class instance whose own method, assigned in the constructor, reads `#count`: it only works with the
 * instance as its receiver.
 */
class Vault {
	#count = 0;
	constructor() {
		/** @returns {number} The count after one more. */
		this.bump = function () {
			return ++this.#count;
		};
	}
}

export default new Vault();

/** @returns {string} A named export merged onto the default. */
export function label() {
	return "named-label";
}
