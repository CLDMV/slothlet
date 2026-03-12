#!/usr/bin/env node
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/generate-types-worker.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:22:18 -08:00 (1772425338)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Worker script for generating TypeScript declaration files
 * This runs in a forked child process to avoid module cache conflicts
 */

import slothlet from "../../index.mjs";
import { generateTypes } from "../../src/lib/processors/type-generator.mjs";

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
