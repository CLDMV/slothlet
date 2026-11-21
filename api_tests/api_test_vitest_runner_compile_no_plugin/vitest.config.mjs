/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vitest_runner_compile_no_plugin/vitest.config.mjs
 *	@Date: 2026-11-17T04:54:31-08:00 (1794920071)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:21-08:00 (1794929181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A vitest config with no slothlet plugin, only `server.deps.inline`: no worker setup records what the
 * vitest server sends, so slothlet cannot check vitest's compile of a module file by its code.
 * @module api_test_vitest_runner_compile_no_plugin.vitest.config
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
	root: here,
	// vite's cache stays out of the fixture, under the repository's ignored `tmp/`.
	cacheDir: path.join(here, "..", "..", "tmp", "vitest-cache", "api_test_vitest_runner_compile_no_plugin"),
	resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] },
	ssr: { resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] } },
	test: {
		include: ["runner-compile.fixture.mjs"],
		environment: "node",
		pool: "forks",
		execArgv: ["--conditions=slothlet-dev"],
		reporters: ["default"],
		testTimeout: 120000,
		server: { deps: { inline: [/@cldmv\/slothlet/] } }
	}
};
