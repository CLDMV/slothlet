/**
 * @fileoverview Simplified LG TV app functionality for testing.
 */

export async function setApp(appName, _ = {}) {
	return { success: true, app: appName };
}

export function getAllApps() {
	return ["Netflix", "YouTube", "Amazon Prime"];
}

export function getCurrentApp() {
	return "Netflix";
}

export async function retrieveCurrentApp(_ = {}) {
	return { app: "Netflix", appId: "netflix" };
}
