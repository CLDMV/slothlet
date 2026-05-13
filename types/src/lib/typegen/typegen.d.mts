/**
 * Generate a TypeScript declaration file (`.d.ts`) for a Slothlet API directory.
 *
 * Loads the API in eager + fast TypeScript mode (no type-checking pass needed —
 * the structure walk uses the loaded API and source files), writes the `.d.ts`,
 * and shuts the loaded instance down before returning.
 *
 * @param {object} options
 * @param {string} options.dir - Path to the API directory to scan (relative or absolute).
 * @param {string} options.output - Path to write the `.d.ts` file to (relative or absolute).
 * @param {string} options.interfaceName - Name of the generated TypeScript interface (e.g. `"MyApi"`).
 * @param {object} [options.typescript] - Override TypeScript loader config; defaults to `{ mode: "fast" }`.
 * @param {boolean} [options.includeDocumentation=true] - Include JSDoc comments in the generated declaration.
 * @returns {Promise<{filePath: string, content: string}>} Absolute path written and the declaration content.
 * @throws {SlothletError} `INVALID_CONFIG` when `dir`, `output`, or `interfaceName` is missing or not a string.
 * @public
 *
 * @example
 * import { generateTypes } from "@cldmv/slothlet/typegen";
 *
 * await generateTypes({
 *     dir: "./api",
 *     output: "./types/api.d.ts",
 *     interfaceName: "MyApi"
 * });
 */
export function generateTypes(options?: {
    dir: string;
    output: string;
    interfaceName: string;
    typescript?: object | undefined;
    includeDocumentation?: boolean | undefined;
}): Promise<{
    filePath: string;
    content: string;
}>;
//# sourceMappingURL=typegen.d.mts.map