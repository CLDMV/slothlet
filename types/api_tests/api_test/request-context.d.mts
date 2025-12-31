export namespace requestContext {
    /**
     * Get current context data
     * @returns {object} Current context object
     */
    function getContext(): object;
    /**
     * Get specific context property
     * @param {string} key - Context key to retrieve
     * @returns {any} Context value
     */
    function get(key: string): any;
    /**
     * Test async context access
     * @param {number} delay - Delay in milliseconds
     * @returns {Promise<object>} Context after delay
     */
    function getContextAfterDelay(delay?: number): Promise<object>;
}
//# sourceMappingURL=request-context.d.mts.map