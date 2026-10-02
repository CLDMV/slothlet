/**
 * Scan CommonJS source for its named exports and re-exported specifiers.
 * @param {string} source - The module source.
 * @returns {{ names: Set<string>, reexports: string[] }} Names it assigns, and the specifiers whose
 *   exports it re-exports.
 * @internal
 * @example
 * scanCommonJSExports('exports.a = 1; module.exports.b = 2;').names; // Set { "a", "b" }
 */
export function scanCommonJSExports(source: string): {
    names: Set<string>;
    reexports: string[];
};
/**
 * The named exports an ESM importer sees for a CommonJS file: the scan of the file plus, recursively,
 * the names of every CommonJS file it re-exports. `default` is excluded (it is always
 * `module.exports`), as are names that are not well-formed strings.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} source - Its source text.
 * @param {object} io - File access.
 * @param {(file: string) => string} io.readFile - Read a file as UTF-8.
 * @param {(specifier: string, fromFile: string) => string} io.resolve - Resolve a require() specifier
 *   from a file to an absolute path (throws when it cannot).
 * @returns {string[]} The export names, in discovery order.
 * @internal
 * @example
 * commonJSExportNames("/app/lib/h.cjs", source, { readFile, resolve }); // ["bump", "label"]
 */
export function commonJSExportNames(filePath: string, source: string, io: {
    readFile: (file: string) => string;
    resolve: (specifier: string, fromFile: string) => string;
}): string[];
//# sourceMappingURL=cjs-export-names.d.mts.map