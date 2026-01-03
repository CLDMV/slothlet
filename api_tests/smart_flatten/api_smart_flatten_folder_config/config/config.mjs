/**
 * Config file inside config subfolder.
 * Tests what happens when addApi("config", folder) encounters folder/config/config.mjs
 */

export function getNestedConfig() {
	return "nested-config-value";
}

export function setNestedConfig(value) {
	return `set-nested-config-${value}`;
}

export const nestedConfigVersion = "1.0.0";
