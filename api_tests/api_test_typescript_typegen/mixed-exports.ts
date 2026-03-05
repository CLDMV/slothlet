/**
 * Fixture: mixed export patterns that exercise every branch in extractTypesFromFile's visit().
 *
 * - notExported: non-exported var statement → L189 arm1 (hasExport === false)
 * - count: exported const with non-function init → L194 arm1 (not arrow fn / fn expr)
 * - destructured: destructuring export → L191 arm0 (decl.name is not an Identifier)
 * - maybeUndef: exported const without initializer (declare) → L193 arm0 (no init)
 * - handler: exported arrow function → exercises VariableStatement arrow-fn path (already covered)
 */

// Non-exported variable: L189 arm1 — isVariableStatement=true but hasExport=false
const notExported = "internal";

// Exported constant with a non-function initializer: L194 arm1 — not arrow fn / fn expr
export const count = 42;

// Exported destructuring — decl.name is ObjectBindingPattern, not Identifier: L191 arm0
export const { length: strLen } = "hello";

// Ambient declaration (no initializer): L193 arm0 — decl.initializer is undefined
export declare const ambient: string;

// Exported arrow function — exercises L189 arm0 (hasExport) + L194 arm0 (isArrowFunction)
export const handler = (x: number): number => x * 2;
