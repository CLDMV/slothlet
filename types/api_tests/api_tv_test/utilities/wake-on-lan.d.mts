/**
 * @fileoverview Simplified wake-on-lan utility for testing.
 */
export function wake(macAddress: any, _?: {}): Promise<{
    success: boolean;
    macAddress: any;
}>;
export function isValidMacAddress(macAddress: any): boolean;
export function normalizeMacAddress(macAddress: any): any;
//# sourceMappingURL=wake-on-lan.d.mts.map