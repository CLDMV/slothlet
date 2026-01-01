/**
 * Dynamically adds API modules from a new folder to the existing API at a specified path.
 *
 * @function addApiFromFolder
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.add_api
 * @param {object} options - Configuration object
 * @param {string} options.apiPath - Dot-notation path where modules will be added
 * @param {string} options.folderPath - Path to folder containing modules to load
 * @param {object} options.instance - Slothlet instance with api, boundapi, config, modes, etc.
 * @param {object} [options.metadata={}] - Metadata to attach to all loaded functions
 * @returns {Promise<void>}
 * @throws {Error} If API not loaded, invalid parameters, folder does not exist, or merge conflicts
 * @package
 *
 * @description
 * This function enables runtime extension of the API by loading modules from a folder
 * and merging them into a specified location in the API tree. It performs comprehensive
 * validation, supports both relative and absolute paths, handles intermediate object
 * creation, and respects the allowApiOverwrite configuration.
 *
 * The method performs the following steps:
 * 1. Validates that the API is loaded and the folder exists
 * 2. Resolves relative folder paths from the caller location
 * 3. Loads modules from the specified folder using the current loading mode
 * 4. Navigates to the specified API path, creating intermediate objects as needed
 * 5. Merges the new modules into the target location
 * 6. Updates all live bindings to reflect the changes
 *
 * @example
 * // Internal usage
 * import { addApiFromFolder } from "./add_api.mjs";
 *
 * // Add additional modules at runtime.plugins path
 * await addApiFromFolder({
 *   apiPath: "runtime.plugins",
 *   folderPath: "./plugins",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add modules to root level
 * await addApiFromFolder({
 *   apiPath: "utilities",
 *   folderPath: "./utils",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add deep nested modules
 * await addApiFromFolder({
 *   apiPath: "services.external.stripe",
 *   folderPath: "./services/stripe",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add modules with metadata
 * await addApiFromFolder({
 *   apiPath: "plugins",
 *   folderPath: "./untrusted-plugins",
 *   instance: slothletInstance,
 *   metadata: {
 *     trusted: false,
 *     permissions: ["read"],
 *     version: "1.0.0",
 *     author: "external"
 *   }
 * });
 */
export function addApiFromFolder({ apiPath, folderPath, instance, metadata }: {
    apiPath: string;
    folderPath: string;
    instance: object;
    metadata?: object;
}): Promise<void>;
//# sourceMappingURL=add_api.d.mts.map