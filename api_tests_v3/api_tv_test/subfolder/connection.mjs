/**
 * @fileoverview Simplified TV connection functionality for testing.
 */

export async function connect(host, _ = {}) {
	return { success: true, host: host, connected: true };
}

export async function disconnect(_ = {}) {
	return { success: true, connected: false };
}

export function isConnected() {
	return true;
}

export function getConnectionInfo() {
	return { host: "192.168.1.100", port: 3000, connected: true };
}