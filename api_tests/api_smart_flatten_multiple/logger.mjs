/**
 * Another additional module in the multiple files test case
 */

export function debug(message) {
	return `[DEBUG] ${message}`;
}

export function info(message) {
	return `[INFO] ${message}`;
}

export function error(message) {
	return `[ERROR] ${message}`;
}

export default {
	name: "logger",
	level: "info"
};
