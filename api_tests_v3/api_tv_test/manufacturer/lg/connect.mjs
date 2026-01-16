/**
 * LG TV Connection API - Simplified for slothlet testing
 */

export async function connect(host, options = {}) {
	return { success: true, host, options };
}

export async function disconnect() {
	return { success: true };
}

export function getConnection() {
	return { host: "192.168.1.100", port: 9761, connected: true };
}

export function isConnectedToTV() {
	return true;
}

export function isReadyForCommands() {
	return true;
}

export async function sendReceiveRawData(data, timeout = 5000) {
	return { success: true, data, timeout };
}

export default connect;