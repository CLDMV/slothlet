/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_nodes/owner/owner.mjs
 *	@Date: 2026-11-18T21:27:37-08:00 (1795066057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:36-08:00 (1795067856)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module with a class, a subclass, the class exported under a second name, instances of both, and
 * private members on the class's prototype. Runs the prototype probes on its own node through `self`.
 * @module api_test_prototype_nodes/owner
 */
import { self } from "@cldmv/slothlet/runtime";
import * as probes from "../../api_test_prototype_nodes_lib/probes.mjs";

/** A class whose prototype is read through the api. */
export class Box {
	/** @returns {string} Marker. */
	label() {
		return "box";
	}

	/** @returns {string} Marker, read through a getter. */
	get kind() {
		return "box kind";
	}
}

/** A subclass of {@link Box}. */
export class Sub extends Box {
	/** @returns {string} Marker. */
	sub() {
		return "sub";
	}
}

/** The same class under a second name. */
export { Box as Alias };

/** An instance of {@link Box}. */
export const inst = new Box();

/** An instance of {@link Sub}. */
export const subInst = new Sub();

for (const name of probes.PRIVATE_NAMES) Box.prototype[name] = 1;

/**
 * How the module's prototype reads through `self`.
 * @returns {object} The answers.
 */
export function shape() {
	return probes.shape(self.owner);
}

/**
 * Whether the module's prototype is one object by every route through `self`.
 * @returns {object} The answers.
 */
export function identity() {
	return probes.identity(self.owner);
}

/**
 * What the module reads of its prototype's private members through `self`.
 * @returns {object} The answers.
 */
export function privacy() {
	return probes.privacy(self.owner);
}

/**
 * Write onto the module's prototype through `self`.
 * @param {string} route - The route.
 * @param {string} how - The write.
 * @param {string} key - The member.
 * @returns {string} The outcome.
 */
export function write(route, how, key) {
	return probes.write(self.owner, route, how, key);
}

/**
 * The class's prototype at `name`, as this module reads it through `self`.
 * @param {string} name - `"Box"` or `"Alias"`.
 * @returns {object} The prototype.
 */
export function prototypeAt(name) {
	return self.owner[name].prototype;
}

/**
 * Whether the class's own prototype holds `key`, and remove it.
 * @param {string} key - The member.
 * @returns {boolean} Whether it held it.
 */
export function take(key) {
	const held = Object.hasOwn(Box.prototype, key);
	delete Box.prototype[key];
	return held;
}

/**
 * Put `key` back on the class's own prototype.
 * @param {string} key - The member.
 * @returns {void}
 */
export function restore(key) {
	Box.prototype[key] = 1;
}
