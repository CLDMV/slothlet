/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/manifest-resolver.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 08:10:28 -07:00 (1779981028)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Browser-safe factory for the `resolveModuleSpecifier` callback.
 *
 * @description
 * `createManifestResolver(base)` produces a `resolveModuleSpecifier` function that
 * resolves manifest-relative file paths to absolute URLs using the standard
 * `new URL(path, base)` algorithm. This is the correct resolver for any deployment
 * where API modules are served from a known base URL (the vast majority of use cases).
 *
 * This file has **no Node.js-specific imports** — it is safe to include in a browser
 * bundle directly. For the build-time `generateManifest` utility (which uses `node:fs`)
 * see `@cldmv/slothlet/helpers/generate-manifest`.
 *
 * ### Typical browser workflow
 *
 * ```text
 * Build time  →  generateManifest("./src/api")  →  api-manifest.json
 * Bundle time →  import api-manifest.json
 * Runtime     →  createManifestResolver(import.meta.url)  →  pass to slothlet()
 * ```
 *
 * @example
 * // API modules live next to the current module
 * import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
 * import manifest from "./api-manifest.json" assert { type: "json" };
 * import { slothlet } from "@cldmv/slothlet";
 *
 * const api = await slothlet({
 *   manifest,
 *   resolveModuleSpecifier: createManifestResolver(import.meta.url)
 * });
 *
 * @example
 * // API modules live in a sub-directory relative to the current module
 * import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
 *
 * const api = await slothlet({
 *   manifest,
 *   resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
 * });
 *
 * @module @cldmv/slothlet/helpers/manifest-resolver
 * @public
 */
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