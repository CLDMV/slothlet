/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_proto_members/host/probe.mjs
 *	@Date: 2026-11-22T12:43:28-08:00 (1795380208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:15-08:00 (1795868955)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code that looks at the api root and at the data module's objects through `self`.
 * @module api_test_proto_members/host/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What the api root reports of its prototype through `self`, as the test asks the same of a plain object.
 * @param {object|null} prototype - The prototype the root was given.
 * @returns {object} What it showed.
 */
export function rootShown(prototype) {
	const reported = Object.getPrototypeOf(self);
	return {
		same: reported === prototype,
		stable: reported === Object.getPrototypeOf(self),
		kind: reported === Object.prototype ? "Object.prototype" : reported === null ? "null" : "other",
		reads: [
			reported?.inheritedRoot,
			self.inheritedRoot,
			"inheritedRoot" in self,
			typeof self.greet === "function" ? self.greet() : undefined
		],
		isPrototypeOf: reported === null ? null : Object.prototype.isPrototypeOf.call(reported, self)
	};
}

/**
 * Call an inherited method of one of the data module's objects through `self`, then list it.
 * @param {"obj"|"inst"} which - Which object.
 * @returns {{called: string, keys: string[], own: boolean, has: boolean}} What it showed.
 */
export function callAndList(which) {
	const value = self.data[which];
	const called = value.hello();
	return { called, keys: Object.keys(value), own: Object.hasOwn(value, "hello"), has: "hello" in value };
}
