/**
 * String operations in TypeScript
 */

/**
 * Capitalize first letter of a string
 * @param str - Input string
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to lowercase
 * @param str - Input string
 * @returns Lowercase string
 */
export function lowercase(str: string): string {
	return str.toLowerCase();
}

/**
 * Convert string to uppercase
 * @param str - Input string
 * @returns Uppercase string
 */
export function uppercase(str: string): string {
	return str.toUpperCase();
}
