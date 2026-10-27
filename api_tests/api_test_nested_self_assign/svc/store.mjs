/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/svc/store.mjs
 *	@Date: 2026-10-18T00:40:09-07:00 (1792309209)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:58:29-07:00 (1792310309)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "svc" (moduleID "svc") by the nested self-assign ownership tests (#625).

/**
 * A class instance: its methods get the instance itself as their receiver (#590).
 */
class Store {
	constructor() {
		this.secret = "store-secret";
	}

	/**
	 * @returns {Store} The receiver.
	 */
	getThis() {
		return this;
	}

	/**
	 * @returns {Promise<Store>} The receiver.
	 */
	async getThisAsync() {
		return this;
	}

	/**
	 * @returns {string} The instance's secret.
	 */
	read() {
		return this.secret;
	}
}

export default new Store();
