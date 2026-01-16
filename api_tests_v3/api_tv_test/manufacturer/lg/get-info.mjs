/**
 * @fileoverview Simplified LG TV info functionality for testing.
 */

export async function getInfo(_ = {}) {
	return { model: "LG TV", version: "1.0.0" };
}

export async function getPowerState() {
	return "on";
}

export function getConnectionStatus() {
	return "connected";
}

export function getKeysInfo() {
	return { availableKeys: ["power", "home", "up", "down"] };
}

export async function getStatus(_ = {}) {
	return { power: "on", connected: true };
}

export async function retrieveInitialState() {
	return { initialized: true };
}

export async function retrieveCurrentChannel(_ = {}) {
	return { channel: 4, name: "Test Channel" };
}

export async function retrieveCurrentApp(_ = {}) {
	return { app: "Netflix", appId: "netflix" };
}

export async function testResponsiveness(_ = {}) {
	return { responsive: true, latency: 50 };
}
