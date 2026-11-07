/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/vitest/vitest.config.mjs
 *	@Date: 2026-11-06T19:31:46-08:00 (1794022306)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:56-08:00 (1794022796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vitest config of the late-files fixture (#714): slothlet runs through vitest's module runner
 * (`server.deps.inline`, as rummage's config has it) with the `slothletInstanceImports()` plugin.
 * @module api_test_vite_late_files.vitest.config
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
	root: here,
	// vite's cache stays out of the fixture, under the repository's ignored `tmp/`.
	cacheDir: path.join(here, "..", "..", "..", "tmp", "vitest-cache", "api_test_vite_late_files"),
	plugins: [slothletInstanceImports()],
	resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] },
	ssr: { resolve: { conditions: ["slothlet-dev", "node", "import", "module", "default"] } },
	test: {
		include: ["late-calls.fixture.mjs"],
		environment: "node",
		pool: "forks",
		execArgv: ["--conditions=slothlet-dev"],
		reporters: ["default"],
		testTimeout: 120000,
		server: { deps: { inline: [/@cldmv\/slothlet/] } }
	}
};
