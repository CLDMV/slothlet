/**
 * Compile a glob pattern into a matcher function.
 * Supports: * (any chars except .), ** (any chars including .), ? (single char),
 * {a,b} brace expansion, !pattern negation
 *
 * @param {string} pattern - Glob pattern
 * @param {object} [options={}] - Options
 * @param {Function} [options.onMaxDepth] - Called when brace expansion exceeds max depth.
 *   Should throw an error. If not provided, a generic Error is thrown.
 * @returns {function} Matcher function that takes a path and returns boolean
 * @example
 * const matcher = compilePattern("payments.**");
 * matcher("payments.charge"); // true
 * matcher("admin.users");     // false
 */
export function compilePattern(pattern: string, options?: {
    onMaxDepth?: Function;
}): Function;
/**
 * Expand brace patterns {a,b,c} into multiple patterns.
 * Supports nested braces with configurable depth limit.
 *
 * @param {string} pattern - Pattern with braces to expand
 * @param {number} [depth=0] - Current recursion depth
 * @param {number} [maxDepth=10] - Maximum nesting depth
 * @param {object} [options={}] - Options
 * @param {Function} [options.onMaxDepth] - Called when max depth exceeded. Should throw.
 * @returns {string[]} Array of expanded patterns
 * @example
 * expandBraces("{a,b}.path"); // ["a.path", "b.path"]
 */
export function expandBraces(pattern: string, depth?: number, maxDepth?: number, options?: {
    onMaxDepth?: Function;
}): string[];
/**
 * Split brace alternatives on commas, respecting nested braces.
 *
 * @param {string} content - Content inside braces
 * @returns {string[]} Array of alternatives
 * @example
 * splitBraceAlternatives("a,b,c"); // ["a", "b", "c"]
 */
export function splitBraceAlternatives(content: string): string[];
//# sourceMappingURL=pattern-matcher.d.mts.map