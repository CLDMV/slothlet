/**
 * Compares two objects or functions-with-methods and reports differences in keys and function signatures.
 * Recursively walks through nested objects and functions to provide comprehensive comparison.
 * @param {function|object} a - First object or function to compare.
 * @param {function|object} b - Second object or function to compare.
 * @param {object} [options] - Optional settings.
 * @param {number} [options.maxDepth=10] - Maximum recursion depth to prevent infinite loops.
 * @param {string} [currentPath=""] - Internal: current path for recursion tracking.
 * @param {number} [currentDepth=0] - Internal: current recursion depth.
 * @param {Set} [checkedPaths] - Internal: set to track all checked paths for verification.
 * @param {WeakSet} [visitedA] - Internal: set to track visited objects in A for circular reference detection.
 * @param {WeakSet} [visitedB] - Internal: set to track visited objects in B for circular reference detection.
 * @returns {object} Report of differences: { onlyInA, onlyInB, differingFunctions, differingValues, nestedDifferences, checkedPaths }
 * @example
 * compareApiShapes(obj1, obj2);
 */
export function compareApiShapes(a: Function | object, b: Function | object, options?: {
    maxDepth?: number;
}, currentPath?: string, currentDepth?: number, checkedPaths?: Set<any>, visitedA?: WeakSet<any>, visitedB?: WeakSet<any>): object;
//# sourceMappingURL=debug-slothlet.d.mts.map