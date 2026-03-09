/**
 * Generate TypeScript declaration file for a Slothlet API
 * @param {object} api - The loaded Slothlet API
 * @param {object} options - Generation options
 * @param {string} options.output - Output file path for .d.ts
 * @param {string} options.interfaceName - Name of the interface to generate
 * @param {boolean} [options.includeDocumentation=true] - Include JSDoc comments
 * @returns {Promise<{output: string, filePath: string}>} Generated declaration and output path
 * @public
 */
export function generateTypes(api: object, options: {
    output: string;
    interfaceName: string;
    includeDocumentation?: boolean;
}): Promise<{
    output: string;
    filePath: string;
}>;
//# sourceMappingURL=type-generator.d.mts.map