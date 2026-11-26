/**
 * Turn a raw JSDoc body (the text between `/**` and `*\/`) into the lines to emit: the description, then the kept
 * tags. A `*\/` inside the text is escaped so it cannot close the generated comment early.
 * @param {string} raw - The JSDoc body.
 * @returns {string[]|null} The comment's content lines, or `null` when nothing worth carrying remains.
 * @private
 */
export function formatDocLines(raw: string): string[] | null;
/**
 * The JSDoc lines for a node's originating export, read from its module file.
 * @param {{filePath: string, exportPath: string[]}|null} origin - The node's ownership origin.
 * @param {Map<string, object|null>} cache - Per-generation cache of scanned files (filePath → scan, or `null` when the
 *   file could not be read).
 * @returns {string[]|null} The comment's content lines, or `null` when the export carries no JSDoc.
 * @public
 *
 * @description
 * Lookup order: the export path as declared (`export function add`, a member of an exported object literal, a
 * CommonJS `exports.name =`); then the same path through a re-export alias; then the file-level binding it names,
 * for an export that refers to a binding declared elsewhere in the file (`module.exports = { shout }`,
 * `export default greet`, `export { add }`).
 *
 * @example
 * docLinesFor({ filePath: "/abs/api/math.mjs", exportPath: ["add"] }, new Map());
 * // ["Add two numbers.", "@param a - First addend.", "@param b - Second addend.", "@returns The sum."]
 */
export function docLinesFor(origin: {
    filePath: string;
    exportPath: string[];
} | null, cache: Map<string, object | null>): string[] | null;
//# sourceMappingURL=type-docs.d.mts.map