/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_holders/owner/owner.mjs
 *	@Date: 2026-11-19T04:53:20-08:00 (1795092800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-19T05:13:28-08:00 (1795094008)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module exporting the classes: what its own code reads of them through `self`.
 * @module api_test_prototype_holders/owner
 */
import { self } from "@cldmv/slothlet/runtime";
import { Box, Bus, Foo } from "../../api_test_prototype_holders_lib/classes.mjs";

export { Box, Bus, Foo, Foo as Alias };

export const bus = new Bus();

export const inst = new Box();

/**
 * What the owner's own code answers comparing what `self` hands it with the classes it imported.
 * @returns {object} The answers.
 */
export function identity() {
	return {
		busInstanceOfImport: self.owner.bus instanceof Bus,
		busPrototypeIsImport: Object.getPrototypeOf(self.owner.bus) === Bus.prototype,
		busReflectIsImport: Reflect.getPrototypeOf(self.owner.bus) === Bus.prototype,
		busAccessorIsImport: self.owner.bus.__proto__ === Bus.prototype,
		boxPrototypeIsImport: self.owner.Box.prototype === Box.prototype,
		instPrototypeIsImport: Object.getPrototypeOf(self.owner.inst) === Box.prototype,
		freshPrototype: Object.getPrototypeOf(new self.owner.Box()) === self.owner.Box.prototype,
		freshPrototypeIsImport: Object.getPrototypeOf(new self.owner.Box()) === Box.prototype,
		fooIsAlias: self.owner.Foo.prototype === self.owner.Alias.prototype
	};
}

/**
 * The prototype of `Box` as the owner holds it, handed to whoever calls.
 * @returns {object} The prototype.
 */
export function rawBoxPrototype() {
	return Box.prototype;
}

/**
 * The prototype of `Box` as the owner reads it through `self`, handed to whoever calls.
 * @returns {object} The prototype.
 */
export function selfBoxPrototype() {
	return self.owner.Box.prototype;
}

/**
 * Whether the owner's code holds a prototype handed back to it as the one it imported.
 * @param {object} prototype - What it was handed.
 * @returns {boolean} The answer.
 */
export function isBoxPrototype(prototype) {
	return prototype === Box.prototype;
}

/**
 * Whether `Box.prototype` holds `key`, removing it.
 * @param {string} key - The key.
 * @returns {boolean} Whether it was there.
 */
export function take(key) {
	const held = Object.hasOwn(Box.prototype, key);
	delete Box.prototype[key];
	return held;
}
