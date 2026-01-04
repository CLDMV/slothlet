/**
 * Test folder for smart flattening Case 1: Single file matching API path
 * Scenario: addApi("config", "./config-folder") where folder contains only config.mjs
 * Expected: api.config.{functions} (not api.config.config.{functions})
 */
export function getConfig(): string;
export function setConfig(value: any): string;
export function validateConfig(): boolean;
declare namespace _default {
    let name: string;
    let type: string;
}
export default _default;
//# sourceMappingURL=config.d.mts.map