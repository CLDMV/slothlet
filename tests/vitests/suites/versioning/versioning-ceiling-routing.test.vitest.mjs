/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/versioning/versioning-ceiling-routing.test.vitest.mjs
 *	@Date: 2026-11-25T01:29:44-08:00 (1795598984)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:16-08:00 (1795869196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Version routing of code a module supplies to another module's call (#597): the supplier's routing is
 * taken only where its ceiling would be routed the same way; otherwise the default version answers.
 *
 * @module tests/vitests/suites/versioning/versioning-ceiling-routing.test.vitest
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(process.cwd(), "api_tests/api_test_version_ceiling");

describe.each(getMatrixConfigs())("Versioning > routing of caller-supplied code > $name", ({ config }) => {
	let api;
	// Tag the discriminator answers per caller module, by the caller's first path segment.
	let routes = {};

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the instance with auth v1 (default) and v2.
	 * @returns {Promise<object>} The api.
	 */
	async function build() {
		api = await slothlet({
			...config,
			base: path.join(FIXTURE, "api"),
			versioning: { dispatcher: (_all, caller) => routes[caller?.path?.[0]] ?? null }
		});
		await api.slothlet.api.add("auth", path.join(FIXTURE, "v1"), { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", path.join(FIXTURE, "v2"), { version: { tag: "v2" } });
		return api;
	}

	it("control: the supplier calling directly is routed as itself", async () => {
		routes = { supplier: "v2", callee: "v1" };
		await build();
		expect(await api.supplier.probe.direct()).toBe("v2");
	});

	it("takes the supplier's routing when its ceiling is routed the same way", async () => {
		routes = { supplier: "v2", callee: "v2" };
		await build();
		expect(await api.supplier.probe.inside()).toBe("v2");
	});

	it("falls back to the default when the supplier and its ceiling are routed differently", async () => {
		routes = { supplier: "v2", callee: "v1" };
		await build();
		expect(await api.supplier.probe.inside()).toBe("v1");
	});

	it("falls back to the default when the supplier is routed nowhere", async () => {
		routes = { callee: "v2" };
		await build();
		expect(await api.supplier.probe.inside()).toBe("v1");
	});
});
