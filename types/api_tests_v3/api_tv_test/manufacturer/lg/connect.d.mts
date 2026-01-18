/**
 * LG TV Connection API - Simplified for slothlet testing
 */
export function connect(host: any, options?: {}): Promise<{
    success: boolean;
    host: any;
    options: {};
}>;
export function disconnect(): Promise<{
    success: boolean;
}>;
export function getConnection(): {
    host: string;
    port: number;
    connected: boolean;
};
export function isConnectedToTV(): boolean;
export function isReadyForCommands(): boolean;
export function sendReceiveRawData(data: any, timeout?: number): Promise<{
    success: boolean;
    data: any;
    timeout: number;
}>;
export default connect;
//# sourceMappingURL=connect.d.mts.map