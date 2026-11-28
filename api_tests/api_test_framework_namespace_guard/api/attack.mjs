/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_framework_namespace_guard/api/attack.mjs
 *	@Date: 2026-10-18T15:34:55-07:00 (1792362895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:02-08:00 (1795868882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes this module tries to make to the framework namespace (#625); see `../lib/attacks.mjs`.
 */
import * as attacks from "../lib/attacks.mjs";

/**
 * @param {string} name - Member of the namespace.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeMember("pin");
 */
export function changeMember(name) {
	return attacks.changeMember(name);
}

/**
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeNamespace();
 */
export function changeNamespace() {
	return attacks.changeNamespace();
}

/**
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeNested();
 */
export function changeNested() {
	return attacks.changeNested();
}

/**
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeRootFunctions();
 */
export function changeRootFunctions() {
	return attacks.changeRootFunctions();
}

/**
 * @returns {function(): Record<string, string>} Writes to the kept namespace later.
 * @example
 * keepNamespace()();
 */
export function keepNamespace() {
	return attacks.keepNamespace();
}

/**
 * @param {string} name - Member to write.
 * @param {*} value - Value written.
 * @returns {string} Outcome of the write.
 * @example
 * writeMember("hostGranted", 1);
 */
export function writeMember(name, value) {
	return attacks.writeMember(name, value);
}

/**
 * @returns {string} Outcome of planting the setter.
 * @example
 * plantPermissionsSetter();
 */
export function plantPermissionsSetter() {
	return attacks.plantPermissionsSetter();
}

/**
 * @returns {object} What it read.
 * @example
 * readAndCall();
 */
export function readAndCall() {
	return attacks.readAndCall();
}

/**
 * @returns {Function} `self.slothlet.materialize.get` as the module read it.
 * @example
 * keepMaterializeGet()();
 */
export function keepMaterializeGet() {
	return attacks.keepMaterializeGet();
}

/**
 * @returns {boolean} Whether a member the host fixed on the namespace reads the same twice.
 * @example
 * readHostFixed(); // true
 */
export function readHostFixed() {
	return attacks.readHostFixed();
}
