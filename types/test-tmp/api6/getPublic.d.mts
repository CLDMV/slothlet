/**
 * Get public configuration value (convenience wrapper)
 * Only accesses public namespace, no privileged data
 *
 * @param {string} key - Configuration key (without public: prefix)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If config not loaded
 *
 * @example
 * getPublic("NODE_ENV")  // Same as get("public:NODE_ENV")
 * getPublic("PORT")      // Same as get("public:PORT")
 */
export default function getPublic(key: string, defaultValue?: any): any;
//# sourceMappingURL=getPublic.d.mts.map