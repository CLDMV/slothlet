/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_captured/viewer.mjs
 *	@Date: 2026-11-25T01:47:11-08:00 (1795600031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:01-08:00 (1795869001)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module showing what it reads of another module through `self`.
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Show the owner's values with `util.inspect`, and use them.
 * @returns {object} What each showed or returned.
 */
export function look() {
	return {
		arrowType: typeof self.owner.arrow,
		arrowCall: self.owner.arrow(),
		arrowShown: util.inspect(self.owner.arrow),
		confShown: util.inspect(self.owner.conf, { getters: true }),
		confPlain: util.inspect(self.owner.conf),
		shapeShown: util.inspect(self.owner.Shape, { showHidden: true }),
		area: new self.owner.Shape().area(),
		agenShown: util.inspect(self.owner.agen),
		genShown: util.inspect(self.owner.gen),
		laterShown: util.inspect(self.owner.later)
	};
}

/** An object of the viewer's own. */
export const mine = { a: 1 };

/**
 * Close the viewer's own values through `self` and change their prototypes.
 * @returns {object} What each change answered.
 */
export function closeOwn() {
	const own = self.viewer.mine;
	return {
		closed: Reflect.preventExtensions(own),
		otherProto: Reflect.setPrototypeOf(own, {}),
		sameProto: Reflect.setPrototypeOf(own, Object.prototype),
		extensible: Reflect.isExtensible(own)
	};
}

/**
 * Serialize the owner's object that has its own `toJSON`.
 * @returns {string} The JSON text.
 */
export function serialize() {
	return JSON.stringify(self.owner.cfg);
}
