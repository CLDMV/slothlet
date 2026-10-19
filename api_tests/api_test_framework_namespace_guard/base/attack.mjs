/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_namespace_guard/base/attack.mjs
 *	@Date: 2026-10-18T15:34:55-07:00 (1792362895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T16:33:25-07:00 (1792366405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes this module tries to make to the framework namespace (#625); see `../shared/attacks.mjs`.
 */
import * as attacks from "../shared/attacks.mjs";

/**
 * @param {string} name - Member of the namespace.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeMember("lockCaller");
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
