/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-set-during-materialize.test.vitest.mjs
 *	@Date: 2026-10-02T09:52:29-07:00 (1790959949)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:33-07:00 (1791091713)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage (#543): a value assigned to a lazy namespace while its materialization is
 * in flight must survive once the materialization settles, alongside the module's own children — whether the
 * value is a primitive, a plain object or a function. Eager mode is the control (nothing is ever in flight).
 *
 * Two shapes: a plain namespace, and a namespace placed by a `forceOverwrite` add (its wrapper carries the
 * "replace" collision mode). Before the fix the second lost every assigned value: adopting the materialized
 * impl under "replace" clears the wrapper's existing keys as stale module children, and the assigned values
 * were cleared with them.
 * @module tests/vitests/suites/lazy/lazy-set-during-materialize
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURES = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_lazy_set_materialize");
const BASE = path.join(FIXTURES, "base"); // core/alpha.mjs: ping()
const EXT = path.join(FIXTURES, "ext"); // session/store.mjs: create(); session/vault/lock.mjs: open() => "ext-open"
const SHADOW = path.join(FIXTURES, "shadow"); // store.mjs: create(); vault/lock.mjs: open() => "shadow-open"

describe.each(getMatrixConfigs())("values set on a lazy namespace during its materialization (#543) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it.each([
		["a plain namespace", false, "ext-open"],
		["a namespace placed by a forceOverwrite add", true, "shadow-open"]
	])("keeps a primitive, a plain object and a function set on %s while it materializes", async (_label, overwrite, lockResult) => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		if (overwrite) await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
		// Materialize the parent, so `vault` below is the namespace's own wrapper rather than a waiting proxy.
		await api.launcher.session.store.create();

		const vault = api.launcher.session.vault;
		if (config.mode === "lazy") {
			// Reading `vault` started its materialization; it has not settled yet.
			expect(resolveWrapper(vault).____slothletInternal.state.inFlight).toBe(true);
		}
		const settings = { retries: 3 };
		vault.note = "x";
		vault.settings = settings;
		vault.describe = () => "described";

		// Settles the materialization.
		expect(await vault.lock.open()).toBe(lockResult);

		const settled = api.launcher.session.vault;
		expect(settled.note).toBe("x");
		expect(settled.settings.retries).toBe(3);
		expect(await settled.describe()).toBe("described");
		expect(Object.keys(settled)).toHaveLength(4);
		expect(Object.keys(settled)).toEqual(expect.arrayContaining(["lock", "note", "settings", "describe"]));
	});
});
