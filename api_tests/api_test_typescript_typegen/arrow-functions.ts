/**
 * Fixture: TypeScript file using arrow function and function expression export syntax.
 * Used to exercise the VariableStatement branch in extractTypesFromFile.
 */

/** Double a number — arrow function export */
export const double = (x: number): number => x * 2;

/** Format first + last name — multi-param arrow function */
export const formatName = (first: string, last: string): string => `${first} ${last}`;

/** Negate a boolean — function expression export */
export const negate = function (value: boolean): boolean {
	return !value;
};
