/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_imports/vitest/vitest.config.mjs
 *	@Date: 2026-11-08T15:50:17-08:00 (1794181817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:40-08:00 (1794182440)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vitest config of the own-package fixture (#715): slothlet runs through vitest's module runner
 * (`server.deps.inline`) with the `slothletInstanceImports()` plugin.
 * @module api_test_own_package_imports.vitest.config
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Loaded by Node at run time, from a file beside this one, so the build of slothlet the process's export conditions name is
// the one used: vitest bundles a config's static imports itself, under the default conditions.
const PLUGIN = pathToFileURL(path.join(here, "plugin.mjs")).href;
const { slothletInstanceImports } = await import(PLUGIN);

export default {
	root: here,
	// vite's cache stays out of the fixture, under the repository's ignored `tmp/`.
	cacheDir: path.join(here, "..", "..", "..", "tmp", "vitest-cache", "api_test_own_package_imports"),
	plugins: [slothletInstanceImports()],
	resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] },
	ssr: { resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] } },
	test: {
		// The plugin under test writes the code vite runs, so no transform cached from an earlier run is reused.
		fsModuleCache: false,
		include: ["calls.fixture.mjs"],
		environment: "node",
		pool: "forks",
		execArgv: ["--conditions=slothlet-dev"],
		reporters: ["default"],
		testTimeout: 120000,
		server: { deps: { inline: [/@cldmv\/slothlet/] } }
	}
};
