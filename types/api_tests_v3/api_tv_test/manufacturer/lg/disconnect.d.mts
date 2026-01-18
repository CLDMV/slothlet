/**
 * @fileoverview Simplified LG TV disconnect functionality for testing.
 */
export function disconnect(_?: {}): Promise<{
    success: boolean;
}>;
export function forceDisconnect(): Promise<{
    success: boolean;
}>;
export function isConnected(): boolean;
export function isReady(): boolean;
export function getStatus(): string;
export default disconnect;
//# sourceMappingURL=disconnect.d.mts.map