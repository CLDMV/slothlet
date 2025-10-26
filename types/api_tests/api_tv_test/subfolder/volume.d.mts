/**
 * @fileoverview Simplified TV volume functionality for testing.
 */
export function up(_?: {}): Promise<{
    success: boolean;
    volume: number;
    action: string;
}>;
export function down(_?: {}): Promise<{
    success: boolean;
    volume: number;
    action: string;
}>;
export function set(level: any, _?: {}): Promise<{
    success: boolean;
    volume: any;
}>;
export function mute(mute?: boolean, _?: {}): Promise<{
    success: boolean;
    muted: boolean;
}>;
export function unmute(_?: {}): Promise<{
    success: boolean;
    muted: boolean;
}>;
export function toggleMute(_?: {}): Promise<{
    success: boolean;
    muted: boolean;
}>;
export function pseudoMute(mute?: boolean, _?: {}): Promise<{
    success: boolean;
    pseudoMuted: boolean;
}>;
export function pseudoUnmute(_?: {}): Promise<{
    success: boolean;
    pseudoMuted: boolean;
}>;
export function togglePseudoMute(_?: {}): Promise<{
    success: boolean;
    pseudoMuted: boolean;
}>;
export function change(delta: any, _?: {}): Promise<{
    success: boolean;
    volume: any;
    delta: any;
}>;
export function getPseudoMuteState(): {
    pseudoMuted: boolean;
    savedVolume: number;
};
export function getMaxVolume(): number;
export function setMaxVolume(level: any): {
    success: boolean;
    maxVolume: any;
};
export function retrieveCurrentVolume(_?: {}): Promise<{
    volume: number;
}>;
export function retrieveCurrentMute(_?: {}): Promise<{
    muted: boolean;
}>;
export function keyUp(_?: {}): Promise<{
    success: boolean;
    key: string;
}>;
export function keyDown(_?: {}): Promise<{
    success: boolean;
    key: string;
}>;
export default set;
//# sourceMappingURL=volume.d.mts.map