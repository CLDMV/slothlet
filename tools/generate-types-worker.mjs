#!/usr/bin/env node

/**
 * Worker script for generating TypeScript declaration files
 * This runs in a forked child process to avoid module cache conflicts
 */

import slothlet from "../index.mjs";
import { generateTypes } from "../src/lib/processors/type-generator.mjs";

async function main() {
	try {
		// Get config from environment
		const configJson = process.env.SLOTHLET_CONFIG;
		if (!configJson) {
			throw new Error("SLOTHLET_CONFIG environment variable not set");
		}
		
		const config = JSON.parse(configJson);
		
		// Load API in eager mode with fast TypeScript mode
		const api = await slothlet(config);
		
		try {
			// Generate types from loaded API
			await generateTypes(api, config.types);
			
			// Send success message to parent
			if (process.send) {
				process.send({ type: 'success' });
			}
			
			// Shutdown cleanly
			await api.slothlet.shutdown();
			
			process.exit(0);
		} catch (error) {
			// Send error message to parent
			if (process.send) {
				process.send({ type: 'error', error: error.message });
			}
			
			await api.slothlet.shutdown();
			process.exit(1);
		}
	} catch (error) {
		console.error("Type generation worker failed:", error);
		
		if (process.send) {
			process.send({ type: 'error', error: error.message });
		}
		
		process.exit(1);
	}
}

main();
