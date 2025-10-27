/**
 * @fileoverview Simplified TV power functionality for testing.
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
export function getState(_?: {}): Promise<{
    state: string;
}>;
export default toggle;
//# sourceMappingURL=power.d.mts.map