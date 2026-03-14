/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:56 -08:00 (1772425016)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { defineConfig } from "vitest/config";
import { DefaultReporter } from "vitest/reporters";
// import path from "node:path";

export class CustomReporter extends DefaultReporter {
	onPathsCollected(paths) {
		super.onPathsCollected(paths);

		this.renderSucceed = false;
	}
}

process.env.NODE_ENV = "development";

// Ensure NODE_OPTIONS is set BEFORE any vitest initialization
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes("slothlet-")) {
	const devFlag = "--conditions=slothlet-dev";
	const current = process.env.NODE_OPTIONS || "";
	process.env.NODE_OPTIONS = current ? `${current} ${devFlag}` : devFlag;
}

// Use V3 slothlet-dev condition
const slothletCondition = "slothlet-dev";

export default defineConfig({
	pool: "forks",
	// pool: "threads",
	resolve: {
		// IMPORTANT: this *replaces* the defaults, so keep the usual ones too
		conditions: [
			slothletCondition, // V3 (slothlet-dev)
			"module",
			"browser",
			"development|production" // keep the special one for other deps
		]
	},
	ssr: {
		// Vitest often goes through SSR resolve pipeline even in node/jsdom tests
		resolve: {
			conditions: [slothletCondition, "node", "development|production"]
		}
	},
	test: {
		// maxWorkers: 4,
		include: ["tests/vitests/**/*.vest.{js,mjs}", "tests/vitests/**/*.test.vitest.{js,mjs}"],
		exclude: ["node_modules"],
		environment: "node",
		globals: true,
		// globalSetup: "./tests/vitests/setup/global-setup.mjs",
		setupFiles: ["./tests/vitests/setup/vitest.setup.mjs"],
		nodeOptions: [`--conditions=${slothletCondition}`, "--import=./tests/vitests/setup/env-preload.mjs"],
		env: {
			NODE_ENV: "development"
		},
		testTimeout: 30000,
		// reporters: [new CustomReporter()],
		reporters: [["default", { summary: false }]],
		logHeapUsage: true,
		// pool: "forks",
		// poolOptions: {
		// 	forks: {
		// 		singleFork: false
		// 	}
		// },

		silent: false,

		coverage: {
			provider: "v8",
			include: ["src/**"],
			exclude: ["**/*.json", "api_tests/**", "tests/**", "tools/**"],
			reporter: ["text", "html", "json-summary", "json"]
		}
	}
});
