/**
 * Test folder for NO smart flattening - normal behavior
 * Scenario: addApi("services", "./normal-folder") where no files match API path
 * Expected: api.services.module1, api.services.module2 (no flattening)
 */

export function authenticate(user) {
	return `User ${user} authenticated`;
}

export function authorize(user, permission) {
	return `User ${user} authorized for ${permission}`;
}

export default {
	name: "auth-service",
	version: "1.0.0"
};
