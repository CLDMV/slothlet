/**
 * @fileoverview Simplified LG TV send-command functionality for testing.
 */
export function sendCommand(command: any, payload: any, _?: {}): Promise<{
    success: boolean;
    command: any;
    payload: any;
}>;
export function sendUserCommand(command: any, payload: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    command: any;
    payload: any;
}>;
export function sendUpdateCommand(command: any, payload: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    command: any;
    payload: any;
}>;
export function sendWebOSCommand(type: any, uri: any, payload?: {}, id?: any, _?: {}): Promise<{
    success: boolean;
    type: any;
    uri: any;
    payload: {};
    id: any;
}>;
export function sendKeyCommand(keyCode: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    keyCode: any;
}>;
export function sendPowerCommand(on: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    on: any;
}>;
export function sendVolumeCommand(action: any, value: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    action: any;
    value: any;
}>;
export function sendInputCommand(input: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    input: any;
}>;
export function sendAppCommand(appId: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    appId: any;
}>;
export function sendChannelCommand(channel: any, _?: {}): Promise<{
    success: boolean;
    type: string;
    channel: any;
}>;
export default sendCommand;
//# sourceMappingURL=send-command.d.mts.map