/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-29 16:41:27 -08:00 (1769733687)
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

// Determine which slothlet version to use based on NODE_OPTIONS
const nodeOptions = process.env.NODE_OPTIONS || "";
const useV2 = nodeOptions.includes("slothlet-two-dev");
const slothletCondition = useV2 ? "slothlet-two-dev" : "slothlet-dev";

export default defineConfig({
	pool: "forks",
	// pool: "threads",
	resolve: {
		// IMPORTANT: this *replaces* the defaults, so keep the usual ones too
		conditions: [
			slothletCondition, // V3 (slothlet-dev) by default, V2 (slothlet-two-dev) if NODE_OPTIONS set
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
		exclude: ["node_modules", "tests/vitests_v2/**"],
		environment: "node",
		globals: true,
		// globalSetup: "./tests/vitests/setup/global-setup.mjs",
		setupFiles: ["./tests/vitests/setup/vitest.setup.mjs"],
		nodeOptions: [`--conditions=${slothletCondition}`, "--import=./tests/vitests/setup/env-preload.mjs"],
		env: {
			NODE_ENV: "development"
		},
		testTimeout: 10000,
		// reporters: [new CustomReporter()],
		reporters: [["default", { summary: false }]],
		logHeapUsage: true,
		// pool: "forks",
		// poolOptions: {
		// 	forks: {
		// 		singleFork: false
		// 	}
		// },

		silent: false
	}
});
