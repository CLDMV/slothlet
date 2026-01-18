/**
 * @fileoverview Simplified LG TV key functionality for testing.
 */
export function key(keyName: any, _?: {}): Promise<{
    success: boolean;
    key: any;
}>;
export function sequence(keyNames: any, _?: {}): Promise<{
    success: boolean;
    keys: any;
}>;
export function navigation(direction: any, _?: {}): Promise<{
    success: boolean;
    direction: any;
}>;
export function number(number: any, _?: {}): Promise<{
    success: boolean;
    number: any;
}>;
export function volume(action: any, _?: {}): Promise<{
    success: boolean;
    action: any;
}>;
export function channel(action: any, _?: {}): Promise<{
    success: boolean;
    action: any;
}>;
export function color(color: any, _?: {}): Promise<{
    success: boolean;
    color: any;
}>;
export default key;
//# sourceMappingURL=key.d.mts.map