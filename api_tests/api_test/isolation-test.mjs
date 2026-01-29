/**
 * Test module for isolation mode testing
 * Exports a state object that gets mutated to test isolation behavior
 * @module isolation-test
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
