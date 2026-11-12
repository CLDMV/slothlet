/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_plain_js/reader/reader.mjs
 *	@Date: 2026-11-11T23:30:00-08:00 (1794468600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:30:00-08:00 (1794468600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that changes another module's data object through `self`, each change answering how it ended.
 * @module api_test_api_node_plain_js/reader
 */

import { types } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run one change, answering how it ended.
 * @param {function(): *} change - The change.
 * @returns {string} `"written"`, `"refused"` for a change reporting false, or the error's code or name.
 */
function attempt(change) {
	try {
		return change() === false ? "refused" : "written";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * Try every way of changing the owner's `config` through the api.
 * @returns {Object<string, string>} Each change's outcome.
 */
export const change = () => ({
	assign: attempt(() => void (self.owner.config.port = 81)),
	assignNested: attempt(() => void (self.owner.config.nested.a = 2)),
	add: attempt(() => void (self.owner.config.added = 1)),
	define: attempt(() => void Object.defineProperty(self.owner.config, "defined", { value: 1, enumerable: true })),
	remove: attempt(() => delete self.owner.config.nested.a),
	reflectSet: attempt(() => Reflect.set(self.owner.config, "port", 82))
});

/**
 * What this module holds of the owner's data.
 * @returns {{config: boolean, nested: boolean, port: number}} Whether each is a Proxy rather than the owner's object,
 *   and the port it reads.
 */
export const view = () => ({
	config: types.isProxy(self.owner.config),
	nested: types.isProxy(self.owner.config.nested),
	port: self.owner.config.port
});

/**
 * The owner's `config` as this module serializes it.
 * @returns {string} `JSON.stringify(self.owner.config)`.
 */
export const serialize = () => JSON.stringify(self.owner.config);
