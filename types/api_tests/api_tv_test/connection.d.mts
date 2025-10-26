/**
 * @fileoverview Simplified TV connection functionality for testing.
 */
export function connect(host: any, _?: {}): Promise<{
    success: boolean;
    host: any;
    connected: boolean;
}>;
export function disconnect(_?: {}): Promise<{
    success: boolean;
    connected: boolean;
}>;
export function isConnected(): boolean;
export function getConnectionInfo(): {
    host: string;
    port: number;
    connected: boolean;
};
//# sourceMappingURL=connection.d.mts.map