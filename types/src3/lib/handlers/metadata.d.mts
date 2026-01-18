export namespace metadataAPI {
    /**
     * Get metadata of the function that called the current function
     * @function caller
     * @memberof metadataAPI
     * @returns {Promise<object|null>} Caller's metadata object or null
     * @public
     */
    function caller(): Promise<object | null>;
    /**
     * Get metadata of the current function
     * @function self
     * @memberof metadataAPI
     * @returns {Promise<object|null>} Current function's metadata or null
     * @public
     */
    function self(): Promise<object | null>;
    /**
     * Get metadata of any function by API path
     * @function get
     * @memberof metadataAPI
     * @param {string} path - Dot-notation API path
     * @param {object} [apiRoot] - Optional API root object
     * @returns {Promise<object|null>} Function's metadata or null
     * @public
     */
    function get(path: string, apiRoot?: object): Promise<object | null>;
}
//# sourceMappingURL=metadata.d.mts.map