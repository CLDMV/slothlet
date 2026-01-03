/**
 * Another module for the no-flattening test case
 */

export function getUser(id) {
	return `User ${id}`;
}

export function updateUser(id, data) {
	return `User ${id} updated with ${data}`;
}

export default {
	name: "user-service",
	version: "1.0.0"
};
