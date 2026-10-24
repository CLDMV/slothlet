/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/svc/bus.mjs
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
import { EventEmitter } from "node:events";

/**
 * An EventEmitter subclass instance: its methods get the instance itself as their receiver (#340).
 */
class Bus extends EventEmitter {
	constructor() {
		super();
		this.secret = "bus-secret";
	}

	/**
	 * @returns {Bus} The receiver.
	 */
	getThis() {
		return this;
	}

	/**
	 * @returns {Promise<Bus>} The receiver.
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

export default new Bus();
