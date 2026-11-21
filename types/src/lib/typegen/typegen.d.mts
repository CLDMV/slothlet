/**
 * Generate a TypeScript declaration file (`.d.ts`) for a Slothlet API directory.
 *
 * Loads the API in eager + fast TypeScript mode (no type-checking pass needed —
 * the structure walk uses the loaded API and source files), writes the `.d.ts`,
 * and shuts the loaded instance down before returning.
 *
 * @param {object} options - A key not listed here throws `INVALID_CONFIG_UNKNOWN_KEY`.
 * @param {string} options.base - Path to the API directory to scan (relative or absolute).
 * @param {string} options.output - Path to write the `.d.ts` file to (relative or absolute).
 * @param {string} options.name - Name of the generated TypeScript interface (e.g. `"MyApi"`).
 * @param {boolean|string|object} [options.typescript] - Override TypeScript loader config. Same union accepted by `slothlet({ typescript })`: pass `true` (default mode), `"fast"` / `"strict"`, or an object like `{ mode: "fast" }`. Defaults to `{ mode: "fast" }` when omitted.
 * @param {boolean} [options.docs=true] - Include JSDoc comments in the generated declaration.
 * @param {boolean} [options.augment=true] - Extend `SlothletSelf` from `@cldmv/slothlet/runtime` with the
 *   generated interface, so leaves that import `self` get the api's types. Set `false` when another generated
 *   declaration in the same TypeScript program should type `self` instead.
 * @returns {Promise<{filePath: string, content: string}>} Absolute path written and the declaration content.
 * @throws {SlothletError} `INVALID_CONFIG` when `base`, `output`, or `name` is missing or not a string.
 * @public
 *
 * @example
 * import { generate } from "@cldmv/slothlet/typegen";
 *
 * await generate({
 *     base: "./api",
 *     output: "./types/api.d.ts",
 *     name: "MyApi"
 * });
 */
export function generate(options?: {
    base: string;
    output: string;
    name: string;
    typescript?: string | boolean | object | undefined;
    docs?: boolean | undefined;
    augment?: boolean | undefined;
}): Promise<{
    filePath: string;
    content: string;
}>;
//# sourceMappingURL=typegen.d.mts.map