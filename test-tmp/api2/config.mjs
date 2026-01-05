/**
 * Root-level config module with export default (should trigger default flattening)
 */

export function getConfig() {
	return "root-config-value-with-default";
}

export default {
	value: "root-default-config",
	getConfig
};
