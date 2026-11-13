/**
 * Create a `resolveModuleSpecifier` callback that resolves manifest file entries
 * to absolute URLs using a fixed base URL.
 *
 * The returned function implements the exact signature expected by
 * `slothlet({ resolveModuleSpecifier })`: it receives a manifest file entry object
 * and returns an importable URL string.
 *
 * @param {string|URL} base - The base URL that all manifest paths are relative to.
 *   Pass `import.meta.url` when API modules sit next to your entry point, or
 *   `new URL("./api/", import.meta.url)` when they are in a sub-directory.
 * @returns {(entry: { path: string, name: string, fullName: string }) => string}
 *   A `resolveModuleSpecifier` function ready to pass to `slothlet()`.
 *
 * @throws {TypeError} If `base` is not a string or URL instance.
 *
 * @example
 * // Modules in the same directory as the current file
 * const resolver = createManifestResolver(import.meta.url);
 * // resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" })
 * // => "https://example.com/app/math.mjs"
 *
 * @example
 * // Modules in an ./api/ sub-directory
 * const resolver = createManifestResolver(new URL("./api/", import.meta.url));
 * // resolver({ path: "auth.mjs", name: "auth", fullName: "auth.mjs" })
 * // => "https://example.com/app/api/auth.mjs"
 *
 * @example
 * // Full slothlet integration
 * import manifest from "./api-manifest.json" assert { type: "json" };
 * import { slothlet } from "@cldmv/slothlet";
 * import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
 *
 * const api = await slothlet({
 *   manifest,
 *   resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
 * });
 */
export function createManifestResolver(base: string | URL): (entry: {
    path: string;
    name: string;
    fullName: string;
}) => string;
//# sourceMappingURL=manifest-resolver.d.mts.map