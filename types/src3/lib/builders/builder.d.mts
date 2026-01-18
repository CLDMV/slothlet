/**
 * Build API from directory
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Raw API object (unwrapped)
 * @public
 */
export function buildAPI(options: {
    dir: string;
    mode?: string;
    ownership: any;
    config?: any;
}): Promise<any>;
//# sourceMappingURL=builder.d.mts.map