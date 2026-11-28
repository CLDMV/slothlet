/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/api-manager/api-manager-remove-private-takeover.test.vitest.mjs
 *	@Date: 2026-11-15T20:44:39-08:00 (1794804279)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:12-08:00 (1795869072)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Removing an add that took over a path holding module-private members restores the path as it was
 * before the add (#815).
 *
 * @description
 * A `forceOverwrite` add over `billing` replaces `billing.internals.__rate`. Removing the add rolls the path back; that
 * rollback is slothlet's own bookkeeping, so it is never held to the host's privacy policy, and the restored node is
 * the base module's again: its value, its file and its owner. Eager and lazy mode, the async and live runtime, both
 * attributions, both `permissions.private.scope` values, and `private.host` deny and allow. Expected values are the base
 * fixture's own exports, imported plainly.
 * @module tests/vitests/suites/api-manager/api-manager-remove-private-takeover
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_private_scope");
const LAYER = resolve("api_tests/api_test_private_scope_layer");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) =>
			["module", "folder"].flatMap((scope) => ["deny", "allow"].map((host) => ({ mode, runtime, attribution, scope, host })))
		)
	)
);

/**
 * What a read gives, or the code it threw.
 * @param {function(): *} read - The read.
 * @returns {Promise<*>} `{ value, error }`.
 */
const settled = async (read) => {
	try {
		return { value: await read(), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
};

describe.each(configs)("removing a takeover of private members > $mode / $runtime / $attribution / $scope / host $host", (config) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("removes the add and restores the base module's members, readers and answers", async () => {
		const internals = await import(pathToFileURL(`${BASE}/billing/internals.mjs`).href);
		api = await slothlet({
			base: BASE,
			mode: config.mode,
			runtime: config.runtime,
			silent: true,
			permissions: {
				policy: "allow",
				caller: {
					attribution: config.attribution
				},
				rules: [],
				private: { scope: config.scope, host: config.host }
			}
		});
		const own = { value: internals.__rate, error: null };
		const hostAnswer = config.host === "allow" ? own : { value: undefined, error: "PERMISSION_DENIED" };
		expect(await api.billing.reader.read("billing.internals.__rate")).toEqual(own);
		const before = Object.keys(api.billing).sort();
		const hostBefore = await settled(() => api.billing.internals.__rate);
		expect(hostBefore).toEqual(hostAnswer);

		await api.slothlet.api.add("billing", LAYER, { id: "layer", collision: { force: true } });
		expect(await settled(() => api.slothlet.api.remove("layer"))).toEqual({ value: true, error: null });

		expect(Object.keys(api.billing).sort()).toEqual(before);
		expect(api.billing.lreader).toBeUndefined();
		expect(await api.billing.reader.read("billing.internals.__rate")).toEqual(own);
		expect(await settled(() => api.billing.internals.__rate)).toEqual(hostAnswer);
		// The overwritten file's other members come back too.
		expect(await api.billing.reader.read("billing.internals._fee")).toEqual({ value: internals._fee, error: null });
		expect(await settled(() => api.billing.internals.currency)).toEqual({ value: internals.currency, error: null });
		expect(Object.keys(await api.billing.internals).sort()).toEqual(
			Object.keys(internals)
				.sort()
				.filter((key) => config.host === "allow" || !key.startsWith("_"))
		);
	});

	it("restores the same after the add is reloaded first, and keeps the members across a reload of the base", async () => {
		const internals = await import(pathToFileURL(`${BASE}/billing/internals.mjs`).href);
		api = await slothlet({
			base: BASE,
			mode: config.mode,
			runtime: config.runtime,
			silent: true,
			permissions: {
				policy: "allow",
				caller: {
					attribution: config.attribution
				},
				rules: [],
				private: { scope: config.scope, host: config.host }
			}
		});
		await api.billing.reader.read("billing.internals.__rate");
		await api.slothlet.api.add("billing", LAYER, { id: "layer", collision: { force: true } });
		await api.slothlet.api.reload("layer");
		expect(await settled(() => api.slothlet.api.remove("layer"))).toEqual({ value: true, error: null });
		await api.slothlet.reload();
		expect(await api.billing.reader.read("billing.internals.__rate")).toEqual({ value: internals.__rate, error: null });
		expect(await api.billing.reader.read("billing.internals._fee")).toEqual({ value: internals._fee, error: null });
		expect(await settled(() => api.billing.internals.currency)).toEqual({ value: internals.currency, error: null });
	});
});
