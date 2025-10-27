/**
 * @fileoverview Simplified TV app management functionality for testing.
 */

export async function setApp(appName, _ = {}) {
	return { success: true, app: appName };
}

export function getCurrentApp() {
	return "Netflix";
}

export function getAllApps() {
	return ["Netflix", "YouTube", "Amazon Prime", "Disney+"];
}

export async function retrieveCurrentApp(_ = {}) {
	return { app: "Netflix", appId: "netflix" };
}