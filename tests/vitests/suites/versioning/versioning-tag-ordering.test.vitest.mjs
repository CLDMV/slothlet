/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/versioning/versioning-tag-ordering.test.vitest.mjs
 *	@Date: 2026-11-25T11:32:40-08:00 (1795635160)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:17-08:00 (1795869197)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Auto-default ordering for tags that are not plain `major.minor.patch` numbers.
 *
 * @description
 * With no explicit default the highest version wins. A segment that is not a number ("beta") counts as 0, a
 * short tag ("v1") fills the missing minor/patch with 0, and two tags that compare equal on their numbers
 * ("2.0.0" and "2.0.0-beta") are told apart by the suffix, the stable one winning whichever was added first.
 * A function dispatcher called from host code gets no caller, and still resolves; an unknown tag it names falls back
 * to the default.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > tag ordering > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("ranks a non-numeric tag below a numeric one", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });
		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "1.0.0" } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "beta" } });

		expect(api.slothlet.versioning.list("auth").default).toBe("1.0.0");
	});

	it("prefers the stable tag over a pre-release with the same numbers, in either add order", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });
		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "2.0.0" } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "2.0.0-beta" } });

		expect(api.slothlet.versioning.list("auth").default).toBe("2.0.0");
	});

	it("resolves a function dispatcher called from host code, which has no caller", async () => {
		const seen = [];
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: {
				dispatcher: (versions, caller) => {
					seen.push(caller);
					return "v1";
				}
			}
		});
		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1" } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		expect(await api.auth.login("alice")).toMatchObject({ version: "v1", user: "alice" });
		expect(seen).toContain(null);
	});

	it("falls back to the default when a host-called function dispatcher names an unknown tag", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: { dispatcher: () => "v9" }
		});
		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1" } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		expect(await api.auth.login("alice")).toMatchObject({ version: "v2", user: "alice" });
	});
});
