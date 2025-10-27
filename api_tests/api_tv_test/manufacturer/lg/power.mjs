/**
 * @fileoverview Simplified LG TV power functionality for testing.
 */

export async function on(_ = {}) {
	return { success: true, state: "on" };
}

export async function off(_ = {}) {
	return { success: true, state: "off" };
}

export async function toggle(_ = {}) {
	return { success: true, state: "off" };
}

export async function getState() {
	return "on";
}

// Need to define power function for default export
async function power(action, options = {}) {
	switch (action) {
		case "on":
			return await on(options);
		case "off":
			return await off(options);
		case "toggle":
			return await toggle(options);
		default:
			return await getState();
	}
}

export default power;