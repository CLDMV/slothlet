/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_module_object/writer/writer.mjs
 *	@Date: 2026-11-13T01:00:48-08:00 (1794560448)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:20:56-08:00 (1794583256)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that tries to close another module's data object and give it a prototype through `self`.
 * @module api_test_api_node_module_object/writer
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a change, answering how it went.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
function attempt(change) {
	try {
		return change() === false ? "refused" : "done";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * Try one change to the owner's data object.
 * @param {string} how - Which: `"freeze"`, `"seal"`, `"preventExtensions"`, `"freezeNested"`, `"setPrototypeOf"`, `"__proto__"`.
 * @returns {string} How it went.
 */
export const change = (how) => {
	const prototype = { kind: "theirs" };
	const changes = {
		freeze: () => void Object.freeze(self.owner.config),
		seal: () => void Object.seal(self.owner.config),
		preventExtensions: () => Reflect.preventExtensions(self.owner.config),
		freezeNested: () => void Object.freeze(self.owner.config.nested),
		setPrototypeOf: () => Reflect.setPrototypeOf(self.owner.config, prototype),
		["__proto__"]: () => {
			self.owner.config.__proto__ = prototype;
		}
	};
	return attempt(changes[how]);
};
