/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/isolation-test.mjs
 *	@Date: 2026-01-29T00:55:02-08:00 (1769676902)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:05 -08:00 (1770266405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
	* Exported state object for testing isolation
	* In partial mode: shared reference (mutations persist)
	* In full mode: deep cloned (mutations don't persist)
	*/
export const isolationTestState = {
	value: "initial",
	counter: 0,
	nested: { flag: false }
};

/**
	* Get current state value
	* @returns {string} Current state value
	*/
export function isolationTest_getValue() {
	return self.isolationTest.isolationTestState.value;
}

/**
	* Set state value (mutates exported object)
	* @param {string} newValue - New value to set
	*/
export function isolationTest_setValue(newValue) {
	self.isolationTest.isolationTestState.value = newValue;
}

/**
	* Increment counter (mutates exported object)
	* @returns {number} New counter value
	*/
export function isolationTest_increment() {
	self.isolationTest.isolationTestState.counter += 1;
	return self.isolationTest.isolationTestState.counter;
}

/**
	* Get counter value
	* @returns {number} Current counter value
	*/
export function isolationTest_getCounter() {
	return self.isolationTest.isolationTestState.counter;
}

/**
	* Set nested flag (mutates nested object)
	* @param {boolean} flag - Flag value
	*/
export function isolationTest_setFlag(flag) {
	self.isolationTest.isolationTestState.nested.flag = flag;
}

/**
	* Get nested flag value
	* @returns {boolean} Flag value
	*/
export function isolationTest_getFlag() {
	return self.isolationTest.isolationTestState.nested.flag;
}







