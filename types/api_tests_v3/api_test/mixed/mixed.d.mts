/**
 * Named function for mixed export test.
 * @param {string} value - Value to process
 * @returns {string} Processed value
 */
export function mixedNamed(value: string): string;
/**
 * Another named function for mixed export test.
 * @param {number} num - Number to process
 * @returns {number} Processed number
 */
export function mixedAnother(num: number): number;
export default mixedDefault;
/**
 * @fileoverview Mixed export test for Rule 8 Pattern B - filename matches folder, exports mixed default+named.
 * This tests the auto-flattening logic for C10 condition (mixed exports in single-file folder).
 */
/**
 * Default function for mixed export test.
 * @param {string} message - Message to process
 * @returns {string} Processed message
 */
declare function mixedDefault(message: string): string;
//# sourceMappingURL=mixed.d.mts.map