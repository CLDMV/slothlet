/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-read-gating-enumeration.test.vitest.mjs
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
 * Read gating must hold across *enumeration* and *serialization*, not just direct reads.
 * Without this, a caller denied `db.secrets.config.apiKey` could still obtain it via
 * `JSON.stringify()`, and `Object.keys()` would disclose the shape of a namespace the
 * caller has no access to.
 *
 * Denied leaves are redacted rather than throwing, so a partially-permitted namespace
 * stays enumerable; each redaction still emits `permission:denied`, so a denial is never
 * silent to an operator watching the audit stream.
 *
 * Runs the full matrix deliberately. Every probe here reaches its target through an `await` —
 * which is mandatory for lazy access, not an unusual shape — so these also stand as coverage
 * that caller identity survives an await under `runtime: "live"`. It previously did not, and an
 * absent caller reads as host-initiated, so before that was fixed nothing below would have been
 * gated at all in the live configurations.
 */
describe.each(getMatrixConfigs())("Permissions > Read Gating > Enumeration > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Run an enumeration probe against a materialized wrapper.
	 *
	 * A lazy wrapper enumerates empty until it materializes — its `ownKeys` trap kicks
	 * materialization off in the background and reports what it has so far. An assertion made
	 * on that first, cold touch would pass trivially: it would read as "redacted" even with
	 * gating switched off. Calling once to warm and asserting on the second result means every
	 * expectation below is about the gate, not about materialization timing.
	 *
	 * @param {() => Promise<*>} probe - Probe to run.
	 * @returns {Promise<*>} The probe's result once the wrapper is materialized.
	 */
	const warm = async (probe) => {
		await probe();
		return await probe();
	};

	/**
	 * Deny every read of `db.secrets.**` for the `callers.**` modules.
	 * @param {object} [extra] - Extra permission config merged over the defaults.
	 * @returns {Promise<object>} The bound api instance.
	 */
	const denyAll = async (extra = {}) =>
		await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }],
				...extra
			}
		});

	it("JSON.stringify of a denied object does not disclose its values", async () => {
		api = await denyAll();
		const json = await warm(() => api.callers.dataReader.stringifyConfig());
		expect(json).not.toContain("abc123");
		expect(JSON.parse(json)).toEqual({});
	});

	it("Object.keys of a denied object does not disclose its shape", async () => {
		api = await denyAll();
		expect(await warm(() => api.callers.dataReader.keysOfConfig())).toEqual([]);
	});

	it("JSON.stringify of a denied namespace does not disclose its terminal values", async () => {
		api = await denyAll();
		const json = await warm(() => api.callers.dataReader.stringifySecrets());
		expect(json).not.toContain("super-secret-token");
		expect(json).not.toContain("classified");
		expect(json).not.toContain("abc123");
	});

	it("Object.keys of a denied namespace omits its denied terminal exports", async () => {
		api = await denyAll();
		const keys = await warm(() => api.callers.dataReader.keysOfSecrets());
		expect(keys).not.toContain("token");
		expect(keys).not.toContain("label");
		expect(keys).not.toContain("count");
	});

	it("Object.entries and spread stay consistent with keys/stringify", async () => {
		api = await denyAll();
		expect(await warm(() => api.callers.dataReader.entriesOfConfig())).toEqual([]);
		expect(await warm(() => api.callers.dataReader.spreadConfig())).toEqual({});
	});

	it("a permitted leaf stays visible while its denied sibling is redacted", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "callers.**", target: "db.secrets.**", effect: "deny" },
					{ caller: "callers.**", target: "db.secrets.config.publicName", effect: "allow" }
				]
			}
		});

		expect(await warm(() => api.callers.dataReader.keysOfConfig())).toEqual(["publicName"]);
		expect(JSON.parse(await warm(() => api.callers.dataReader.stringifyConfig()))).toEqual({ publicName: "slothlet" });
		expect(await warm(() => api.callers.dataReader.entriesOfConfig())).toEqual([["publicName", "slothlet"]]);
	});

	it("each redacted leaf emits permission:denied so redaction is never silent", async () => {
		api = await denyAll();

		// Warm first, then start listening, so the events counted belong to the asserted call.
		await api.callers.dataReader.keysOfConfig();

		const denied = [];
		api.slothlet.lifecycle.on("permission:denied", (data) => denied.push(data));

		await api.callers.dataReader.keysOfConfig();

		expect(denied.length).toBeGreaterThan(0);
		expect(denied.some((d) => String(d.target).endsWith("db.secrets.config.apiKey"))).toBe(true);
		expect(denied[0]).toHaveProperty("caller");
	});

	it("a direct read of a denied leaf still throws — redaction is enumeration-only", async () => {
		api = await denyAll();
		// Eager throws synchronously out of the call expression, lazy rejects — accept either.
		await expect(async () => await api.callers.dataReader.readToken()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("readGating: false opts out — enumeration discloses everything as before", async () => {
		api = await denyAll({ readGating: false });
		expect(await warm(() => api.callers.dataReader.keysOfConfig())).toEqual(["apiKey", "publicName"]);
		expect(JSON.parse(await warm(() => api.callers.dataReader.stringifyConfig()))).toEqual({ apiKey: "abc123", publicName: "slothlet" });
	});

	it("external (uncontexted) enumeration stays exempt, mirroring direct reads", async () => {
		api = await denyAll();
		// No caller context outside a module — the host sees the full object.
		expect(await warm(async () => Object.keys(await api.db.secrets.config))).toEqual(["apiKey", "publicName"]);
	});
});
