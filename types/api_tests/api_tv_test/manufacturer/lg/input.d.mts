/**
 * @fileoverview Simplified LG TV input functionality for testing.
 */
export function setInput(inputName: any, _?: {}): Promise<{
    success: boolean;
    input: any;
}>;
export function getAllInputNames(): string[];
export function getCurrentInput(): string;
//# sourceMappingURL=input.d.mts.map