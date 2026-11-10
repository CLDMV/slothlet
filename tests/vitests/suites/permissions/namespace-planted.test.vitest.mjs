/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/namespace-planted.test.vitest.mjs
 *	@Date: 2026-11-08T10:30:57-08:00 (1794162657)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T10:34:06-08:00 (1794162846)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The framework's namespace refuses module code it is reached by outside any call of the module's.
 *
 * @description
 * A module leaves functions changing the namespace on an object of the host's and on `globalThis`, and changes it from
 * a timer once its call has returned. The host calls those functions later, outside any call. The change is decided by
 * whose code makes it, not by which call is running, so module code is refused however it is reached and the host's
 * own changes still go through. Checked in eager and lazy mode, async and live runtime, with the permission system on
 * and off, and again after `reload()`.
 * @module tests/vitests/suites/permissions/namespace-planted
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_namespace_handed");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "no permissions config", options: {} },
	{ name: "permissions on", options: { permissions: {} } },
	{ name: "permissions off", options: { permissions: { mode: "off" } } }
];

const PLANTED = ["plantedHanded", "plantedSelf", "plantedGlobal", "plantedTimer"];

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry })))))(
	"a namespace change planted by a module > $mode / $runtime / $name",
	({ mode, runtime, options }) => {
		let api;

		afterEach(async () => {
			delete globalThis.__slothletPlantedChange;
			await api?.slothlet.shutdown();
			api = null;
		});

		it("is refused when the host runs it later, and the host's own change still goes through", async () => {
			api = await slothlet({ base: join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("planter", join(FIXTURE, "planter"), { moduleID: "planter" });
			for (const round of ["first", "reloaded"]) {
				if (round === "reloaded") await api.slothlet.reload();
				const target = {};
				await api.planter.plant(target, api.slothlet);
				expect({
					handed: target.changeHanded(),
					self: target.changeSelf(),
					global: globalThis.__slothletPlantedChange(),
					timer: await api.planter.changeLater(api.slothlet)
				}).toEqual({ handed: "PERMISSION_DENIED", self: "PERMISSION_DENIED", global: "PERMISSION_DENIED", timer: "PERMISSION_DENIED" });
				for (const key of PLANTED) expect(api.slothlet[key]).toBeUndefined();
				api.slothlet.hostOwn = round;
				expect(api.slothlet.hostOwn).toBe(round);
				delete api.slothlet.hostOwn;
			}
		});
	}
);
