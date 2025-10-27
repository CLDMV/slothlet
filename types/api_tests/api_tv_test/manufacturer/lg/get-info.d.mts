/**
 * @fileoverview Simplified LG TV info functionality for testing.
 */
export function getInfo(_?: {}): Promise<{
    model: string;
    version: string;
}>;
export function getPowerState(): Promise<string>;
export function getConnectionStatus(): string;
export function getKeysInfo(): {
    availableKeys: string[];
};
export function getStatus(_?: {}): Promise<{
    power: string;
    connected: boolean;
}>;
export function retrieveInitialState(): Promise<{
    initialized: boolean;
}>;
export function retrieveCurrentChannel(_?: {}): Promise<{
    channel: number;
    name: string;
}>;
export function retrieveCurrentApp(_?: {}): Promise<{
    app: string;
    appId: string;
}>;
export function testResponsiveness(_?: {}): Promise<{
    responsive: boolean;
    latency: number;
}>;
//# sourceMappingURL=get-info.d.mts.map