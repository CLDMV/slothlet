#!/usr/bin/env node

/**
 * Test script to document current multi_defaults behavior before implementing fix
 */

import slothlet from "@cldmv/slothlet";

async function testMultiDefaults() {
	console.log("=== MULTI_DEFAULTS CURRENT BEHAVIOR (BEFORE FIX) ===");
	console.log("");

	const api = await slothlet({ dir: "./api_tests/api_test" });

	console.log("api.multi_defaults structure:");
	console.log(api.multi_defaults);
	console.log("");

	console.log("Available functions:");
	console.log("- api.multi_defaults.sendKey():", typeof api.multi_defaults.sendKey);
	console.log("- api.multi_defaults.toggle():", typeof api.multi_defaults.toggle);
	console.log("- api.multi_defaults.setVolume():", typeof api.multi_defaults.setVolume);
	console.log("");

	console.log("Testing function calls:");
	console.log('api.multi_defaults.sendKey("ENTER"):', api.multi_defaults.sendKey("ENTER"));
	console.log("api.multi_defaults.toggle():", api.multi_defaults.toggle());
	console.log("api.multi_defaults.setVolume(50):", api.multi_defaults.setVolume(50));
	console.log("");

	console.log("Named exports on functions:");
	console.log('api.multi_defaults.sendKey.press("ESC"):', api.multi_defaults.sendKey.press("ESC"));
	console.log("api.multi_defaults.toggle.on():", api.multi_defaults.toggle.on());
	console.log("api.multi_defaults.setVolume.up():", api.multi_defaults.setVolume.up());
	console.log("");

	console.log("=== EXPECTED BEHAVIOR AFTER FIX ===");
	console.log("Should become:");
	console.log('- api.multi_defaults.key("ENTER") // from key.mjs default export');
	console.log("- api.multi_defaults.power() // from power.mjs default export");
	console.log("- api.multi_defaults.volume(50) // from volume.mjs default export");
	console.log("");
	console.log("With named exports as properties:");
	console.log('- api.multi_defaults.key.press("ESC")');
	console.log("- api.multi_defaults.power.on()");
	console.log("- api.multi_defaults.volume.up()");

	await api.shutdown();
}

testMultiDefaults().catch(console.error);
