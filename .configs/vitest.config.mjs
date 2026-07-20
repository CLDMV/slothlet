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
import { DefaultReporter } from "vitest/node";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CustomReporter extends DefaultReporter {
	onPathsCollected(paths) {
		super.onPathsCollected(paths);

		this.renderSucceed = false;
	}
}

process.env.NODE_ENV = process.env.NODE_ENV || "development";

// Resolution mode is decided by whether `src/` is present — the SAME signal tests/test-conditional.mjs
// uses (`buildTestNodeEnv`). While `src/` exists (local dev, and the pre-build CI phase) default to
// `slothlet-dev` so tests exercise and cover the SOURCE tree. In the post-build CI phase `ci-cleanup-src`
// DELETES `src/` and only `dist/` remains — there, do NOT force `slothlet-dev`, or the whole
// `@cldmv/slothlet/*` graph (including a dist file's self-reference to `@cldmv/slothlet/i18n`) resolves
// back into the deleted `src/` and fails with "Cannot find module …/src/lib/i18n/…". The `npm test`
// path strips slothlet-dev in that case; the coverage path runs straight through this config, so it has
// to make the same call here — which is what broke the `next → master` release-PR coverage.
const srcExists = existsSync(path.resolve(__dirname, "../src/slothlet.mjs"));
const useSourceCondition = srcExists;

// Ensure NODE_OPTIONS carries slothlet-dev BEFORE any vitest initialization — source mode only.
if (useSourceCondition) {
	const devFlag = "--conditions=slothlet-dev";
	const current = process.env.NODE_OPTIONS || "";
	process.env.NODE_OPTIONS = current ? `${current} ${devFlag}` : devFlag;
}

// V3 source condition, applied only in source mode. In dist mode it is omitted so the package's
// default `import` condition resolves the whole graph to `dist/` consistently.
const slothletCondition = "slothlet-dev";
const resolveConditions = useSourceCondition
	? [slothletCondition, "module", "browser", "development|production"]
	: ["module", "browser", "development|production"];
const ssrConditions = useSourceCondition ? [slothletCondition, "node", "development|production"] : ["node", "development|production"];
const workerNodeOptions = useSourceCondition
	? [`--conditions=${slothletCondition}`, "--import=./tests/vitests/setup/env-preload.mjs"]
	: ["--import=./tests/vitests/setup/env-preload.mjs"];

export default defineConfig({
	pool: "forks",
	// pool: "threads",
	resolve: {
		// IMPORTANT: this *replaces* the defaults, so keep the usual ones too. `slothlet-dev` is
		// included only in source mode (see `resolveConditions` above); dist mode omits it.
		conditions: resolveConditions
	},
	ssr: {
		// Vitest often goes through SSR resolve pipeline even in node/jsdom tests
		resolve: {
			conditions: ssrConditions
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
		nodeOptions: workerNodeOptions,
		env: {
			NODE_ENV: "development",
			// Propagate the runner's "i18n pack staged" signal to workers so pack-dependent suites can assert
			// it (and fail loudly under a bare `npx vitest` where the runner never staged the pack). Empty when
			// unset → falsy → the guard fires. See tests/vitests/setup/i18n-pack-fixture.mjs.
			SLOTHLET_TEST_PACKS_STAGED: process.env.SLOTHLET_TEST_PACKS_STAGED ?? ""
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
