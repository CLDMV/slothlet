/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-construct-parity.test.vitest.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview H4 — construct/apply enforcement parity. `new proxy(args)` must be gated
 * by the permission manager exactly like a function call. A denied caller's inter-module
 * `new self.widgets.Widget()` throws PERMISSION_DENIED; an allowed caller constructs the
 * instance normally.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Construct Parity > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("denied caller's inter-module `new` throws PERMISSION_DENIED", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "widgets.**", effect: "deny" }]
			}
		});

		await expect(api.callers.widgetCaller.construct("blocked")).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("allowed caller's inter-module `new` constructs the instance", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "widgets.**", effect: "allow" }]
			}
		});

		const widget = await api.callers.widgetCaller.construct("ok");
		expect(widget.label).toBe("ok");
		expect(widget.describe()).toBe("widget:ok");
	});

	it("external `new` from host code (no active module) is exempt", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "**", target: "widgets.**", effect: "deny" }]
			}
		});

		// Direct host construction: no active caller module → exempt (mirrors applyTrap).
		const widget = await new api.widgets.Widget("host");
		expect(widget.label).toBe("host");
	});
});
