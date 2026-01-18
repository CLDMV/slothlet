/**
 * @fileoverview Simplified TV key functionality for testing.
 */
export function key(keyName: any, _?: {}): Promise<{
    success: boolean;
    key: any;
}>;
export function getAllKeyNames(): string[];
export function getKeyCode(keyName: any): any;
export default key;
//# sourceMappingURL=key.d.mts.map