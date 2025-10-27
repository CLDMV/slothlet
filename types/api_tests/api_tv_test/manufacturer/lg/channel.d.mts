/**
 * @fileoverview Simplified LG TV channel functionality for testing.
 */
export function setChannel(channel: any, _?: {}): Promise<{
    success: boolean;
    channel: any;
}>;
export function up(_?: {}): Promise<{
    success: boolean;
    channel: number;
}>;
export function down(_?: {}): Promise<{
    success: boolean;
    channel: number;
}>;
export function getCurrentChannel(): number;
export function retrieveCurrentChannel(_?: {}): Promise<{
    channel: number;
    name: string;
}>;
//# sourceMappingURL=channel.d.mts.map