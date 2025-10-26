/**
 * @fileoverview Simplified TV state management functionality for testing.
 */
export function cloneState(): {
    power: string;
    volume: number;
    channel: number;
};
export function emitLog(level: any, message: any, _?: {}): void;
export function getSnapshot(): {
    power: string;
    volume: number;
    channel: number;
    input: string;
    app: string;
};
export function reset(_?: {}): {
    success: boolean;
    reset: boolean;
};
export function getMaxVolume(): number;
export function setMaxVolume(level: any, _?: {}): {
    success: boolean;
    maxVolume: any;
};
export function getPseudoMuteState(): {
    muted: boolean;
    savedVolume: number;
};
export function setPseudoMuteState(pseudoMuted: any, savedVolume?: any, _?: {}): {
    success: boolean;
    muted: any;
    savedVolume: any;
};
export function initializeVolumeState(_?: {}): {
    success: boolean;
    initialized: boolean;
};
export function recordUserCommand(partial?: {}, _?: {}): {
    success: boolean;
    command: {};
};
export function recordUpdateCommand(partial?: {}, _?: {}): {
    success: boolean;
    update: {};
};
export function shutdown(_?: {}): {
    success: boolean;
    shutdown: boolean;
};
export function update(partial?: {}, _?: {}): {
    success: boolean;
    updated: {};
};
export function processInboundData(data: any, _?: {}): {
    success: boolean;
    processed: any;
};
//# sourceMappingURL=state.d.mts.map