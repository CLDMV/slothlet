/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_plain_js/host/shapes.mjs
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
 * @fileoverview Ordinary exports (a data object, classes, an instance, functions) whose api nodes are compared with
 * the same module imported as a plain module.
 * @module api_test_api_node_plain_js/shapes
 */

/**
 * A data object with a nested object, a getter and a setter that read and write it through `this`.
 * @type {{port: number, nested: {a: number}, computed: number, scaled: number}}
 */
export const config = {
	port: 80,
	nested: { a: 1 },
	get computed() {
		return this.port + 1;
	},
	set scaled(value) {
		this.port = value * 2;
	}
};

/**
 * An object holding an object with a getter of its own.
 * @type {{inner: {base: number, twice: number}}}
 */
export const outer = {
	inner: {
		base: 2,
		get twice() {
			return this.base * 2;
		}
	}
};

/**
 * A frozen data object.
 * @type {Readonly<{a: number}>}
 */
export const frozen = Object.freeze({ a: 1 });

/**
 * A data object holding a member it keeps read-only.
 * @type {{fixed: number, open: number}}
 */
export const partly = Object.defineProperty({ open: 1 }, "fixed", { value: 1, writable: false, enumerable: true, configurable: true });

/**
 * A list of plain values.
 * @type {Array<number|{deep: number}>}
 */
export const list = [1, { deep: 2 }, 3];

/** A base class. */
export class Animal {
	/**
	 * @param {string} name - The animal's name.
	 */
	constructor(name) {
		this.name = name;
	}
}

/** A derived class. */
export class Dog extends Animal {
	/**
	 * What a dog says.
	 * @returns {string} `"woof"`.
	 */
	speak() {
		return "woof";
	}
}

/**
 * An instance of the derived class.
 * @type {Dog}
 */
export const rex = new Dog("rex");

/**
 * An arrow function.
 * @returns {number} `42`.
 */
export const arrow = () => 42;

/**
 * A function declaration.
 * @param {number} a - A number.
 * @param {number} b - Another.
 * @returns {number} Their sum.
 */
export function named(a, b) {
	return a + b;
}

/**
 * An async function.
 * @returns {Promise<string>} `"later"`.
 */
export const later = async () => "later";

/**
 * The port the module's own `config` holds.
 * @returns {number} `config.port`.
 */
export const readPort = () => config.port;

/**
 * A member of the module's own `config`, read by the module.
 * @param {string} key - The member's key.
 * @returns {*} `config[key]`.
 */
export const read = (key) => config[key];

/**
 * A member of the module's own `config.nested`, read by the module.
 * @param {string} key - The member's key.
 * @returns {*} `config.nested[key]`.
 */
export const readNested = (key) => config.nested[key];

/**
 * The keys the module's own `config` holds.
 * @returns {string[]} `Object.keys(config)`.
 */
export const ownKeys = () => Object.keys(config);

/**
 * How the module's own `config` describes one of its members.
 * @param {string} key - The member's key.
 * @returns {{writable: boolean|undefined, enumerable: boolean, configurable: boolean, accessor: boolean}|null} The description.
 */
export const describe = (key) => {
	const descriptor = Object.getOwnPropertyDescriptor(config, key);
	if (!descriptor) return null;
	return {
		writable: descriptor.writable,
		enumerable: descriptor.enumerable,
		configurable: descriptor.configurable,
		accessor: !("value" in descriptor)
	};
};

/**
 * Whether a value is the very object the module's own `config` holds under a key.
 * @param {string} key - The member's key.
 * @param {*} value - A value.
 * @returns {boolean} `config[key] === value`.
 */
export const holds = (key, value) => config[key] === value;

/**
 * The module's own `partly`, as the module reads it.
 * @returns {{fixed: number, open: number}} A copy of its members.
 */
export const readPartly = () => ({ ...partly });

/**
 * Change the module's own `config` from inside the module.
 * @param {number} port - The new port.
 * @returns {void}
 */
export const setPort = (port) => {
	config.port = port;
};
