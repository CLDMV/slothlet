/**
 * Build API in lazy mode (proxy-based deferred loading)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export function buildLazyAPI({ dir, ownership, config }: {
    dir: string;
    ownership: any;
    config?: any;
}): Promise<any>;
//# sourceMappingURL=lazy.d.mts.map