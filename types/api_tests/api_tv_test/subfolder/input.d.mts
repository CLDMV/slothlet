/**
 * @fileoverview Simplified TV input functionality for testing.
 */
export function setInput(inputName: any, _?: {}): Promise<{
    success: boolean;
    input: any;
}>;
export function getAllInputNames(): string[];
export function getCurrentInput(): string;
export default setInput;
//# sourceMappingURL=input.d.mts.map