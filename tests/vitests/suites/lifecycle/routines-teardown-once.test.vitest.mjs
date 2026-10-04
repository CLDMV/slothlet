/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines-teardown-once.test.vitest.mjs
 *	@Date: 2026-10-02 10:19:37 -07:00 (1790961577)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:23 -07:00 (1791083063)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage (#542): every teardown contribution runs exactly once per teardown.
 *
 * With `autoRoutines: true`, a module's root-level `shutdown` export is both a contribution to the default
 * `mode: "shutdown"` routine and the root shutdown hook the dispose builtin calls. It ran twice: once in the
 * routine run and again as the hook. A root `destroy` export did the same under a `mode: "destroy"` routine.
 *
 * The instance has a root `shutdown`/`destroy` export (the base module) and the same exports one level below
 * the root (a module mounted at `plugin`). Teardown runs through `api.shutdown()`, `api.slothlet.shutdown()`,
 * `api.destroy()` and `api.slothlet.restart()`, with `autoRoutines` on and off:
 * - `autoRoutines: true` — every contribution of every mode the entry point runs fires once.
 * - `autoRoutines: false` — no routine fires automatically; the root hooks still fire once from the root
 *   builtins (`api.shutdown()`, `api.destroy()`) and from `restart()`'s teardown. `api.slothlet.shutdown()` does not call the root hooks
 *   (it runs only the routines), so nothing fires there.
 * @module tests/vitests/suites/lifecycle/routines-teardown-once
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURES = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_routines_teardown_once");
const BASE = path.join(FIXTURES, "base"); // shutdown.mjs, destroy.mjs (root exports), ping.mjs
const PLUGIN = path.join(FIXTURES, "plugin"); // shutdown.mjs, destroy.mjs — mounted at "plugin"

/** The default routines plus a `mode: "destroy"` routine, so `destroy` exports are contributions too. */
const ROUTINES = [...slothlet.defaults.routines, { name: "destroy", mode: "destroy" }];

const TEARDOWNS = {
	"api.shutdown()": (api) => api.shutdown(),
	"api.slothlet.shutdown()": (api) => api.slothlet.shutdown(),
	"api.destroy()": (api) => api.destroy(),
	"api.slothlet.restart()": (api) => api.slothlet.restart()
};

/** Expected call counts per teardown entry point, by `autoRoutines`. */
const EXPECTED = {
	true: {
		"api.shutdown()": { "root.shutdown": 1, "plugin.shutdown": 1 },
		"api.slothlet.shutdown()": { "root.shutdown": 1, "plugin.shutdown": 1 },
		"api.destroy()": { "root.destroy": 1, "plugin.destroy": 1, "root.shutdown": 1, "plugin.shutdown": 1 },
		"api.slothlet.restart()": { "root.shutdown": 1, "plugin.shutdown": 1 }
	},
	false: {
		"api.shutdown()": { "root.shutdown": 1 },
		"api.slothlet.shutdown()": {},
		"api.destroy()": { "root.destroy": 1, "root.shutdown": 1 },
		"api.slothlet.restart()": { "root.shutdown": 1 }
	}
};

/**
 * Count the teardown calls recorded by the fixture modules.
 * @returns {Object<string, number>} Contribution → call count.
 */
function countCalls() {
	const counts = {};
	for (const name of globalThis.__slothletTeardownCalls ?? []) counts[name] = (counts[name] ?? 0) + 1;
	return counts;
}

describe.each(getMatrixConfigs())("each teardown contribution runs once (#542) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api && !api.slothlet?.isDestroyed) {
			try {
				await api.slothlet?.shutdown?.();
			} catch {
				// Already torn down by the test.
			}
		}
		api = null;
		delete globalThis.__slothletTeardownCalls;
	});

	describe.each([true, false])("autoRoutines: %s", (autoRoutines) => {
		it.each(Object.keys(TEARDOWNS))("via %s", async (entry) => {
			api = await slothlet({ ...config, base: BASE, silent: true, autoRoutines, routines: ROUTINES });
			await api.slothlet.api.add("plugin", PLUGIN, { moduleID: "plugin" });
			globalThis.__slothletTeardownCalls = [];

			await TEARDOWNS[entry](api);

			expect(countCalls()).toEqual(EXPECTED[autoRoutines][entry]);
		});
	});

	it("runs the root shutdown export once per restart(), across consecutive restarts (autoRoutines: true)", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, autoRoutines: true, routines: ROUTINES });
		for (let restart = 1; restart <= 2; restart++) {
			globalThis.__slothletTeardownCalls = [];
			await api.slothlet.restart();
			expect(countCalls(), `restart #${restart}`).toEqual({ "root.shutdown": 1 });
		}
	});
});
