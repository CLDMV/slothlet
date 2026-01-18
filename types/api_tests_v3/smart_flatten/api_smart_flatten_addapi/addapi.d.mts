/**
 * Test folder for smart flattening Case 2: Special addapi.mjs file
 * Scenario: addApi("plugins", "./addapi-folder") where folder contains addapi.mjs
 * Expected: api.plugins.{functions} (not api.plugins.addapi.{functions})
 */
export function initializePlugin(): string;
export function pluginMethod(): string;
export function cleanup(): string;
declare namespace _default {
    let special: string;
    let autoFlatten: boolean;
}
export default _default;
//# sourceMappingURL=addapi.d.mts.map