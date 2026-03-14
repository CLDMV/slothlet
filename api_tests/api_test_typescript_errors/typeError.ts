/**
 * TypeScript file with intentional type errors for testing strict mode
 */

/**
 * Function with correct types
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function addNumbers(a: number, b: number): number {
	return a + b;
}

/**
 * Function with type error - tries to return string instead of number
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Should return number but returns string
 */
export function addWithError(a: number, b: number): number {
	return (a + b).toString(); // Type error: string is not assignable to number
}

/**
 * Function with parameter type error
 * @param {number} value - Should be number
 * @returns {number} Double the value
 */
export function doubleValue(value: number): number {
	const str: string = value; // Type error: number is not assignable to string
	return value * 2;
}
