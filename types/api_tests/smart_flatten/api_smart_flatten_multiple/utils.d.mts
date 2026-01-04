/**
 * Test folder for smart flattening Case 3: Multiple files with one matching API path
 * Scenario: addApi("utils", "./utils-folder") where folder contains utils.mjs + other files
 * Expected: api.utils.{utils-functions} + api.utils.other (utils.mjs flattened, others preserved)
 */
export function utilFunction(): string;
export function helperMethod(): string;
export function formatData(data: any): string;
declare namespace _default {
    let module: string;
    let functions: string[];
}
export default _default;
//# sourceMappingURL=utils.d.mts.map