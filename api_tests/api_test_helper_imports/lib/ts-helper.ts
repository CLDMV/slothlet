/**
 * @fileoverview TypeScript helper imported by the `.ts` leaf (#518).
 * @module api_test_helper_imports.lib.tsHelper
 * @internal
 */
let count: number = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
export function tsBump(): number {
	return ++count;
}
