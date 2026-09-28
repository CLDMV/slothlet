/**
 * Generate TypeScript declaration file for a Slothlet API
 * @param {object} api - The loaded Slothlet API (a live, composed instance)
 * @param {object} options - Generation options
 * @param {string} options.output - Output file path for .d.ts
 * @param {string} options.interfaceName - Name of the interface to generate
 * @param {boolean} [options.includeDocumentation=true] - Include the per-member comments that explain an
 *   `unknown` member (a member with no module origin). Accepted for compatibility; the explanation is
 *   always emitted, since an unexplained `unknown` is a worse surprise than one extra comment line.
 * @param {boolean} [options.augmentRuntime=true] - Extend `SlothletSelf` from `@cldmv/slothlet/runtime`
 *   with the generated interface, so an imported `self` is typed as the api. Turn it off when several
 *   generated interfaces live in one TypeScript program and only one of them should type `self`.
 * @returns {Promise<{output: string, filePath: string}>} Generated declaration and output path
 * @public
 *
 * @description
 * Every member references the export slothlet actually placed there — `typeof import("<leaf>")["k"]` —
 * read from the ownership records' module origin (#484), so the declaration carries each leaf's own
 * type (JSDoc, TypeScript, CommonJS alike) instead of a signature guessed from its file's syntax. A
 * namespace becomes a nested object of its members; a callable namespace intersects its function's
 * type with the members merged onto it; a member with no module origin is `unknown`, with a comment.
 */
export function generateTypes(api: object, options: {
    output: string;
    interfaceName: string;
    includeDocumentation?: boolean | undefined;
    augmentRuntime?: boolean | undefined;
}): Promise<{
    output: string;
    filePath: string;
}>;
//# sourceMappingURL=type-generator.d.mts.map