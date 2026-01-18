/**
 * @fileoverview Simplified LG TV power functionality for testing.
 */
export function on(_?: {}): Promise<{
    success: boolean;
    state: string;
}>;
export function off(_?: {}): Promise<{
    success: boolean;
    state: string;
}>;
export function toggle(_?: {}): Promise<{
    success: boolean;
    state: string;
}>;
export function getState(): Promise<string>;
export default power;
declare function power(action: any, options?: {}): Promise<string | {
    success: boolean;
    state: string;
}>;
//# sourceMappingURL=power.d.mts.map