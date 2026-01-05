/**
 * @typedef {Object} AddApiFromFolderParams
 * @property {string} apiPath - Dot-notation path where modules will be added
 * @property {string} folderPath - Path to folder containing modules to load
 * @property {object} instance - Slothlet instance with api, boundapi, config, modes, etc.
 * @property {object} [metadata={}] - Metadata to attach to all loaded functions
 * @property {object} [options={}] - Additional options for module loading
 * @property {boolean} [options.forceOverwrite=false] - Allow overwriting existing APIs (requires Rule 12)
 * @property {string} [options.moduleId] - Module identifier for ownership tracking (required with forceOverwrite)
 */
/**
 * @description
 * Dynamically adds API modules from a new folder to the existing API at a specified path.
 *
 * @function addApiFromFolder
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.add_api
 * @param {AddApiFromFolderParams} params - Configuration object
 * @returns {Promise<void>}
 * @throws {Error} If API not loaded, invalid parameters, folder does not exist, or merge conflicts
 * @package
 *
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
 * await addApiFromFolder(
 *   "runtime.plugins",
 *   "./plugins",
 *   slothletInstance
 * );
 *
 * @example
 * // Add modules to root level
 * await addApiFromFolder(
 *   "utilities",
 *   "./utils",
 *   slothletInstance
 * );
 *
 * @example
 * // Add deep nested modules
 * await addApiFromFolder(
 *   "services.external.stripe",
 *   "./services/stripe",
 *   slothletInstance
 * );
 *
 * @example
 * // Add modules with metadata
 * await addApiFromFolder(
 *   "extensions.untrusted",
 *   "./untrusted-plugins",
 *   slothletInstance,
 *   {
 *     trusted: false,
 *     permissions: ["read"],
 *     version: "1.0.0",
 *     author: "external"
 *   }
 * );
 */
export function addApiFromFolder({ apiPath, folderPath, instance, metadata, options }: AddApiFromFolderParams): Promise<void>;
export type AddApiFromFolderParams = {
    /**
     * - Dot-notation path where modules will be added
     */
    apiPath: string;
    /**
     * - Path to folder containing modules to load
     */
    folderPath: string;
    /**
     * - Slothlet instance with api, boundapi, config, modes, etc.
     */
    instance: object;
    /**
     * - Metadata to attach to all loaded functions
     */
    metadata?: object;
    /**
     * - Additional options for module loading
     */
    options?: {
        forceOverwrite?: boolean;
        moduleId?: string;
    };
};
//# sourceMappingURL=add_api.d.mts.map