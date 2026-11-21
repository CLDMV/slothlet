/**
 * Whether a parsed manifest is written in the deprecated format 1 (`schemaVersion`, `mountPath`, `apiDir`).
 * @param {object} manifest - Parsed manifest.
 * @returns {boolean} True when it uses any format 1 field name.
 */
export function isFormat1(manifest: object): boolean;
/**
 * Validate a parsed slothlet.module.json manifest and return a normalized form.
 *
 * @param {object} manifest - Parsed JSON manifest object (must already be valid JSON).
 * @param {object} packageContext - Context derived from the host package.
 * @param {string} packageContext.packageName - npm package `name` from package.json.
 * @param {string} packageContext.packageVersion - npm package `version` from package.json.
 * @param {string} [packageContext.packageDescription] - npm package `description` from package.json.
 * @param {string} packageContext.packageRoot - Absolute filesystem path to the package root.
 * @param {string} packageContext.manifestPath - Path to the manifest file (used in error context for diagnostics).
 * @returns {object} Normalized manifest with the following shape:
 *   - All optional fields filled in from defaults / package.json fallbacks
 *   - `name`, `version` always present (from package.json if absent in manifest)
 *   - `description` from manifest (override) or package.json (fallback)
 *   - `priority` defaults to 0 if absent
 *   - `mount` normalized to an array of segments
 * @throws {SlothletError} with `MODULE_*` code on any validation failure.
 *
 * @example
 * const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
 * const pkgJson = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
 * const normalized = validateModuleManifest(manifest, {
 *   packageName: pkgJson.name,
 *   packageVersion: pkgJson.version,
 *   packageDescription: pkgJson.description,
 *   packageRoot,
 *   manifestPath
 * });
 */
export function validateModuleManifest(manifest: object, packageContext: {
    packageName: string;
    packageVersion: string;
    packageDescription?: string | undefined;
    packageRoot: string;
    manifestPath: string;
}): object;
//# sourceMappingURL=module-manifest-validator.d.mts.map