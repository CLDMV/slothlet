/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-manifest-layer.test.vitest.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #407 — the manifest precedence layer for event rules.
 *
 * A module's `slothlet.module.json` may declare event rules; they register at the "manifest" layer at
 * mount. A manifest rule overrides the built-in default, and the composing host's instance-config rule
 * of equal specificity overrides the manifest — verifying built-in < manifest < instance end to end.
 *
 * The mounted module's manifest here declares a rule about the base `subscriber` module's access
 * (`{ caller: "subscriber.**", event: "manifest.*", effect: "allow" }`). Using the base subscriber to
 * do the subscribing keeps the fixture's own leaf trivial — a folder fixture with its own package.json
 * cannot self-reference `@cldmv/slothlet/runtime` in-repo, so its leaf imports nothing.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_EVT_MODULE = path.resolve(__dirname, "../../../../api_tests/api_test_events_module");

describe.each(getMatrixConfigs())("Events > manifest precedence layer (#407) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("without the module mounted, the base subscriber gets the notify default", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST_EVENTS,
			silent: true,
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		expect(await api.subscriber.subscribe("manifest.data")).toBe("notify");
	});

	it("mounting a module whose manifest declares an event rule grants that rule (overriding the default)", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST_EVENTS,
			silent: true,
			permissions: { defaultPolicy: "allow", events: { default: "notify" } }
		});
		await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX_EVT_MODULE } });

		// Manifest: { caller: subscriber.**, event: manifest.*, effect: allow } — registered at mount.
		expect(await api.subscriber.subscribe("manifest.data")).toBe("allow");
		await api.emitter.fire("manifest.data", { v: 1 });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toEqual({ v: 1 });

		// An event outside the manifest rule still falls back to the notify default.
		expect(await api.subscriber.subscribe("other.thing")).toBe("notify");
	});

	it("an instance-config rule of equal specificity overrides the module's manifest rule", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST_EVENTS,
			silent: true,
			// Same specificity as the manifest's { subscriber.**, manifest.* } → instance layer wins.
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "subscriber.**", event: "manifest.*", effect: "notify" }] }
			}
		});
		await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX_EVT_MODULE } });

		// Manifest says allow; instance says notify at equal specificity → instance wins.
		expect(await api.subscriber.subscribe("manifest.data")).toBe("notify");
		await api.emitter.fire("manifest.data", { v: 2 });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toBeUndefined(); // notify → trigger only
	});
});
