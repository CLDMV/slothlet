/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_holders/reader/reader.mjs
 *	@Date: 2026-11-19T04:53:36-08:00 (1795092816)
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
 * @fileoverview Another module reading the owner's classes through `self`, holding the same classes by its own import.
 * @module api_test_prototype_holders/reader
 */
import { self } from "@cldmv/slothlet/runtime";
import { Box, Bus, attempt } from "../../api_test_prototype_holders_lib/classes.mjs";

/**
 * What the reader answers comparing what `self` hands it, among itself and with the classes it imported.
 * @returns {object} The answers.
 */
export function identity() {
	return {
		busInstanceOfNode: self.owner.bus instanceof self.owner.Bus,
		busPrototypeIsNodes: Object.getPrototypeOf(self.owner.bus) === self.owner.Bus.prototype,
		instPrototypeIsNodes: Object.getPrototypeOf(self.owner.inst) === self.owner.Box.prototype,
		freshPrototype: Object.getPrototypeOf(new self.owner.Box()) === self.owner.Box.prototype,
		freshReflect: Reflect.getPrototypeOf(new self.owner.Box()) === self.owner.Box.prototype,
		freshAccessor: new self.owner.Box().__proto__ === self.owner.Box.prototype,
		freshConstructor: new self.owner.Box().constructor.prototype === self.owner.Box.prototype,
		stable: self.owner.Box.prototype === self.owner.Box.prototype,
		fooIsAlias: self.owner.Foo.prototype === self.owner.Alias.prototype,
		busInstanceOfImport: self.owner.bus instanceof Bus,
		boxPrototypeIsImport: self.owner.Box.prototype === Box.prototype,
		freshPrototypeIsImport: Object.getPrototypeOf(new self.owner.Box()) === Box.prototype
	};
}

/**
 * What `self.slothlet.same` answers the reader.
 * @returns {object} The answers.
 */
export function same() {
	const { same: isSame } = self.slothlet;
	return {
		handleAndImport: isSame(self.owner.Box.prototype, Box.prototype),
		instanceAndImport: isSame(Object.getPrototypeOf(self.owner.bus), Bus.prototype),
		freshAndImport: isSame(Object.getPrototypeOf(new self.owner.Box()), Box.prototype),
		nodeAndImport: isSame(self.owner.Box, Box),
		fooAndAlias: isSame(self.owner.Foo.prototype, self.owner.Alias.prototype),
		boxAndFoo: isSame(self.owner.Box.prototype, self.owner.Foo.prototype),
		handedAndImport: isSame(self.owner.rawBoxPrototype(), Box.prototype),
		unrelated: isSame({}, {}),
		primitive: isSame(1, 1),
		nodeAndOtherNode: isSame(self.owner.Box, self.owner.Bus)
	};
}

/**
 * Write `key` on Box's prototype by each route a module may reach it, a fresh instance's among them.
 * @param {string} key - The key, suffixed per route.
 * @returns {object} Each route's outcome.
 */
export function writes(key) {
	const write = (target, suffix) =>
		attempt(() => {
			target()[`${key}_${suffix}`] = 1;
			return "done";
		});
	return {
		classPrototype: write(() => self.owner.Box.prototype, "classPrototype"),
		instPrototype: write(() => Object.getPrototypeOf(self.owner.inst), "instPrototype"),
		freshPrototype: write(() => Object.getPrototypeOf(new self.owner.Box()), "freshPrototype"),
		freshReflect: write(() => Reflect.getPrototypeOf(new self.owner.Box()), "freshReflect"),
		freshAccessor: write(() => new self.owner.Box().__proto__, "freshAccessor"),
		freshConstructor: write(() => new self.owner.Box().constructor.prototype, "freshConstructor"),
		handed: write(() => self.owner.rawBoxPrototype(), "handed")
	};
}

/**
 * Read Box's module-private member by each route.
 * @returns {object} Each route's outcome.
 */
export function privateReads() {
	return {
		classPrototype: attempt(() => self.owner.Box.prototype._secret),
		freshPrototype: attempt(() => Object.getPrototypeOf(new self.owner.Box())._secret),
		handed: attempt(() => self.owner.rawBoxPrototype()._secret),
		listed: attempt(() => Object.getOwnPropertyNames(self.owner.Box.prototype).includes("_secret"))
	};
}

/**
 * Create a module-private member on Box's prototype by each route.
 * @param {string} key - The key, starting with an underscore, suffixed per route.
 * @returns {object} Each route's outcome.
 */
export function privateWrites(key) {
	const write = (target, suffix) =>
		attempt(() => {
			target()[`${key}_${suffix}`] = 1;
			return "done";
		});
	return {
		classPrototype: write(() => self.owner.Box.prototype, "classPrototype"),
		freshPrototype: write(() => Object.getPrototypeOf(new self.owner.Box()), "freshPrototype")
	};
}

/**
 * Hand what `self` gave the reader of Box's prototype back to the owner.
 * @returns {boolean} Whether the owner holds it as its own prototype.
 */
export function handBack() {
	return self.owner.isBoxPrototype(self.owner.Box.prototype);
}
