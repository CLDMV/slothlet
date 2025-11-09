/**
 * Comprehensive runtime verification that tests all aspects of the runtime system.
 * @function verifyRuntime
 * @returns {object} Complete runtime verification results
 */
export function verifyRuntime(): object;
/**
 * Test self cross-calls using math operations.
 * @function testSelfCrossCall
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {object} Cross-call test results
 */
export function testSelfCrossCall(a?: number, b?: number): object;
/**
 * Test context isolation by checking for unique context data.
 * @function testContextIsolation
 * @returns {object} Context isolation test results
 */
export function testContextIsolation(): object;
/**
 * Performance test to help distinguish between runtime types.
 * @function testPerformance
 * @returns {object} Performance test results
 */
export function testPerformance(): object;
/**
 * Comprehensive runtime test that combines all verification methods.
 * @function comprehensiveRuntimeTest
 * @returns {object} Complete runtime test results
 */
export function comprehensiveRuntimeTest(): object;
//# sourceMappingURL=runtime-test.d.mts.map