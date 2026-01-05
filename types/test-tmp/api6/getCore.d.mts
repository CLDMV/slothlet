/**
 * Get core configuration value (convenience wrapper)
 * Only accessible by @asbuilt/* packages
 *
 * @param {string} key - Configuration key (without core: prefix)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If access denied or config not loaded
 *
 * @example
 * getCore("DATABASE_URL")  // Same as get("core:DATABASE_URL")
 * getCore("JWT_SECRET")    // Same as get("core:JWT_SECRET")
 */
export default function getCore(key: string, defaultValue?: any): any;
//# sourceMappingURL=getCore.d.mts.map