/**
 * @fileoverview Simplified LG TV volume functionality for testing.
 */
export function up(_?: {}): Promise<{
    success: boolean;
    volume: number;
}>;
export function down(_?: {}): Promise<{
    success: boolean;
    volume: number;
}>;
export function set(level: any, _?: {}): Promise<{
    success: boolean;
    volume: any;
}>;
export function mute(mute?: boolean, _?: {}): Promise<{
    success: boolean;
    mute: boolean;
}>;
export function unmute(_?: {}): Promise<{
    success: boolean;
    mute: boolean;
}>;
export function toggleMute(_?: {}): Promise<{
    success: boolean;
    mute: boolean;
}>;
export function pseudoMute(mute?: boolean, _?: {}): Promise<{
    success: boolean;
    pseudoMute: boolean;
}>;
export function pseudoUnmute(_?: {}): Promise<{
    success: boolean;
    pseudoMute: boolean;
}>;
export function togglePseudoMute(_?: {}): Promise<{
    success: boolean;
    pseudoMute: boolean;
}>;
export function getPseudoMuteState(): boolean;
export function getMaxVolume(): number;
export function setMaxVolume(level: any): {
    success: boolean;
    maxVolume: any;
};
export function change(delta: any, _?: {}): Promise<{
    success: boolean;
    volume: any;
}>;
export function retrieveCurrentVolume(_?: {}): Promise<{
    volume: number;
}>;
export function retrieveCurrentMute(_?: {}): Promise<{
    mute: boolean;
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