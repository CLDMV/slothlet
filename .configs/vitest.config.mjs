/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-09 19:52:57 -08:00 (1768017177)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
	// pool: "forks",
	pool: "threads",
	resolve: {
		// IMPORTANT: this *replaces* the defaults, so keep the usual ones too
		conditions: [
			"slothlet-dev", // your custom branch
			"module",
			"browser",
			"development|production" // keep the special one for other deps
		]
	},
	ssr: {
		// Vitest often goes through SSR resolve pipeline even in node/jsdom tests
		resolve: {
			conditions: ["slothlet-dev", "node", "development|production"]
		}
	},
	test: {
		// maxWorkers: 4,
		include: ["tests/**/*.vest.{js,mjs}", "tests/**/*.test.vitest.{js,mjs}"],
		exclude: ["node_modules"],
		environment: "node",
		globals: true,
		globalSetup: ["./tests/vitests/global-setup.mjs"],
		nodeOptions: ["--conditions=slothlet-dev"],
		env: {
			NODE_ENV: "development"
		},
		testTimeout: 10000,
		reporters: ["verbose"],
		logHeapUsage: false,

		silent: "passed-only"
	}
});
