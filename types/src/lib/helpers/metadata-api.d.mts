export namespace metadataAPI {
    /**
     * Get metadata of the function that called the current function.
     *
     * @function caller
     * @memberof metadataAPI
     * @returns {object|null} Caller's metadata object or null if not found
     * @public
     *
     * @description
     * Uses stack trace analysis to identify the calling function and retrieve
     * its attached metadata. Useful for implementing access control where a
     * function needs to verify the identity/permissions of its caller.
     *
     * Stack trace structure:
     * - Line 0: Error
     * - Line 1: metadataAPI.caller (this function)
     * - Line 2: Current function (the one checking)
     * - Line 3: The caller we want to identify
     *
     * @example
     * // In a secure function
     * import { metadataAPI } from "@cldmv/slothlet/runtime";
     *
     * export function getSecrets() {
     *     const caller = metadataAPI.caller();
     *
     *     if (!caller?.trusted) {
     *         throw new Error("Access denied: untrusted caller");
     *     }
     *
     *     if (!caller.permissions?.includes("read_secrets")) {
     *         throw new Error("Access denied: insufficient permissions");
     *     }
     *
     *     return { apiKey: "secret123", token: "xyz" };
     * }
     *
     * @example
     * // With custom metadata tags
     * const caller = metadataAPI.caller();
     * console.log("Caller source:", caller?.sourceFolder);
     * console.log("Caller version:", caller?.version);
     * console.log("Caller author:", caller?.author);
     */
    function caller(): object | null;
    /**
     * Get metadata of the current function.
     *
     * @function self
     * @memberof metadataAPI
     * @returns {object|null} Current function's metadata or null if not found
     * @public
     *
     * @description
     * Retrieves metadata attached to the currently executing function. Useful
     * for functions that need to inspect their own metadata (e.g., for logging,
     * conditional behavior based on load source).
     *
     * Stack trace structure:
     * - Line 0: Error
     * - Line 1: metadataAPI.self (this function)
     * - Line 2: Current function (the one we want to identify)
     *
     * @example
     * // Function checking its own metadata
     * import { metadataAPI } from "@cldmv/slothlet/runtime";
     *
     * export function smartFunction() {
     *     const meta = metadataAPI.self();
     *
     *     if (meta?.environment === "development") {
     *         console.log("Running in development mode");
     *     }
     *
     *     if (meta?.version) {
     *         console.log(`Function version: ${meta.version}`);
     *     }
     *
     *     return "result";
     * }
     */
    function self(): object | null;
    /**
     * Get metadata of any function by API path.
     *
     * @function get
     * @memberof metadataAPI
     * @param {string} path - Dot-notation API path (e.g., "math.add", "plugins.helper")
     * @param {object} [apiRoot] - Optional API root object (uses runtime.self if not provided)
     * @returns {object|null} Function's metadata or null if not found
     * @public
     *
     * @description
     * Retrieves metadata for any function in the API tree by its path. Useful
     * for checking metadata of functions you have references to, or for
     * administrative/introspection purposes.
     *
     * @example
     * // Check metadata of a specific function
     * import { metadataAPI } from "@cldmv/slothlet/runtime";
     *
     * export function checkPermissions() {
     *     const pluginMeta = metadataAPI.get("plugins.userPlugin");
     *
     *     if (!pluginMeta) {
     *         throw new Error("Plugin not found or has no metadata");
     *     }
     *
     *     if (pluginMeta.trusted) {
     *         console.log("Plugin is trusted");
     *     } else {
     *         console.log("Plugin is untrusted");
     *     }
     * }
     *
     * @example
     * // Iterate and check all plugins
     * const pluginPaths = ["plugins.auth", "plugins.logger", "plugins.cache"];
     * for (const path of pluginPaths) {
     *     const meta = metadataAPI.get(path);
     *     console.log(`${path}: ${meta?.version || "unknown"}`);
     * }
     *
     * @example
     * // From outside slothlet context, pass API root explicitly
     * const api = await slothlet({ dir: "./modules" });
     * const meta = await metadataAPI.get("plugins.helper", api);
     */
    function get(path: string, apiRoot?: object): object | null;
}
//# sourceMappingURL=metadata-api.d.mts.map