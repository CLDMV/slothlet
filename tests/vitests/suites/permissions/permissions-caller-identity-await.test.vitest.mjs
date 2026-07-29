/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-identity-await.test.vitest.mjs
 *	@Date: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

/**
 * Caller identity must survive an `await` inside a module body.
 *
 * Enforcement resolves the calling module from the active context, and a read or call with no
 * resolvable caller is treated as host-initiated and exempt. So if identity is dropped partway
 * through a module body, enforcement does not merely lose precision — it fails *open*, and any
 * module gets past its deny rules by awaiting something first. Awaiting is mandatory for lazy
 * access, which makes this the ordinary shape of module code rather than a corner case.
 *
 * The live-bindings manager tracks the active call in a single mutable slot and used to clear it
 * in a synchronous `finally` — which runs when an async function reaches its first `await`, not
 * when it finishes. These cases pin the identity to the call's full logical duration.
 */
describe.each(getMatrixConfigs())("Permissions > Caller Identity Across Await > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a denied read stays denied after awaiting a resolved promise", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		await expect(async () => await api.callers.dataReader.readTokenAfterAwait()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("a denied read stays denied after awaiting a timer", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		await expect(async () => await api.callers.dataReader.readTokenAfterTimer()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("a denied call stays denied after an await under defaultPolicy deny", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny", rules: [] }
		});

		await expect(async () => await api.callers.dataReader.insertAfterAwait()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("an allowed call still succeeds after an await — identity is kept, not merely blocked", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.dataReader.**", target: "db.write.**", effect: "allow" }]
			}
		});

		expect(await api.callers.dataReader.insertAfterAwait()).toMatchObject({ ok: true, module: "db.write" });
	});
});
