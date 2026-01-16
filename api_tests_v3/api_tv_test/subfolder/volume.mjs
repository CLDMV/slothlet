/**
 * @fileoverview Simplified TV volume functionality for testing.
 */

export async function up(_ = {}) {
	return { success: true, volume: 55, action: "up" };
}

export async function down(_ = {}) {
	return { success: true, volume: 45, action: "down" };
}

export async function set(level, _ = {}) {
	return { success: true, volume: level };
}

export async function mute(mute = true, _ = {}) {
	return { success: true, muted: mute };
}

export async function unmute(_ = {}) {
	return { success: true, muted: false };
}

export async function toggleMute(_ = {}) {
	return { success: true, muted: true };
}

export async function pseudoMute(mute = true, _ = {}) {
	return { success: true, pseudoMuted: mute };
}

export async function pseudoUnmute(_ = {}) {
	return { success: true, pseudoMuted: false };
}

export async function togglePseudoMute(_ = {}) {
	return { success: true, pseudoMuted: true };
}

export async function change(delta, _ = {}) {
	return { success: true, volume: 50 + delta, delta: delta };
}

export function getPseudoMuteState() {
	return { pseudoMuted: false, savedVolume: 50 };
}

export function getMaxVolume() {
	return 100;
}

export function setMaxVolume(level) {
	return { success: true, maxVolume: level };
}

export async function retrieveCurrentVolume(_ = {}) {
	return { volume: 50 };
}

export async function retrieveCurrentMute(_ = {}) {
	return { muted: false };
}

export async function keyUp(_ = {}) {
	return { success: true, key: "volume_up" };
}

export async function keyDown(_ = {}) {
	return { success: true, key: "volume_down" };
}

export default set;