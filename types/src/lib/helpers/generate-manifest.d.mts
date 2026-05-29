/**
 * Generate a slothlet browser manifest by scanning a directory at build time.
 *
 * This is the primary entry point for producing the `manifest` object required by
 * `slothlet({ manifest, resolveModuleSpecifier })`. Call this once during your build
 * step and embed the result in your browser bundle.
 *
 * @param {string} dir - Absolute or relative path to the API root directory.
 * @returns {Promise<{ files: Array<{path:string,name:string,fullName:string}>, directories: Array }>}
 *   Manifest object ready to pass to `slothlet()`.
 *
 * @throws {Error} If `dir` is not a non-empty string.
 * @throws {Error} If `dir` cannot be read (does not exist, not a directory, permission denied).
 *
 * @example
 * // Build script — produces a manifest and writes it to disk
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 * import { writeFileSync } from "node:fs";
 *
 * const manifest = await generateManifest("./src/api");
 * writeFileSync("./dist/api-manifest.json", JSON.stringify(manifest, null, 2));
 *
 * @example
 * // Vite plugin — inline manifest into the browser bundle
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 *
 * export function slothletManifestPlugin(apiDir) {
 *   return {
 *     name: "slothlet-manifest",
 *     async buildStart() {
 *       const manifest = await generateManifest(apiDir);
 *       this.emitFile({
 *         type: "asset",
 *         fileName: "slothlet-manifest.json",
 *         source: JSON.stringify(manifest)
 *       });
 *     }
 *   };
 * }
 */
export function generateManifest(dir: string): Promise<{
    files: Array<{
        path: string;
        name: string;
        fullName: string;
    }>;
    directories: any[];
}>;
//# sourceMappingURL=generate-manifest.d.mts.map