/**
 * Special addapi.mjs file in folder with subfolders.
 * Tests: addApi("plugins", folder) where folder has addapi.mjs + subfolders
 * Expected behavior:
 * - addapi.mjs contents should be flattened to root level (api.plugins.{functions})
 * - Subfolders should NOT be flattened (api.plugins.config.{functions}, api.plugins.utils.{functions})
 */
export function initializeMainPlugin(): string;
export function pluginGlobalMethod(): string;
export const pluginVersion: "1.0.0";
//# sourceMappingURL=addapi.d.mts.map