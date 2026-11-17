/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-private-scope.test.vitest.mjs
 *	@Date: 2026-11-15T19:26:16-08:00 (1794799576)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T20:14:49-08:00 (1794802489)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Which callers a module-private (`_`/`__`) member is open to: the module that owns it (the default,
 * `permissions.private.scope: "module"`), or the files of the folder that exports it (`"folder"`).
 *
 * @description
 * Under `"module"` a member is private to the module ID that owns its path: every leaf the same module owns reads it,
 * whatever folder it sits in, and every other module and the host are refused. Under `"folder"` it is private to the
 * folder of files that exports it, as before 3.25.0. The base folder's files all belong to the base module; each
 * `api.slothlet.api.add()` is the module of its moduleID (given or generated); a later add that takes over a path owns
 * the member there; an in-memory object leaf is its own module at its path. The expected values are the fixture
 * files' own exports, imported plainly.
 * @module tests/vitests/suites/permissions/permissions-private-scope
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

const BASE = resolve("api_tests/api_test_private_scope");
const EXT = resolve("api_tests/api_test_private_scope_ext");
const LAYER = resolve("api_tests/api_test_private_scope_layer");
const TWIN = resolve("api_tests/api_test_private_scope_twin");

const DENIED = { value: undefined, error: "PERMISSION_DENIED" };

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * A fixture file imported plainly.
 * @param {string} file - The file's absolute path.
 * @returns {Promise<object>} Its namespace.
 */
const plain = (file) => import(pathToFileURL(file).href);

/**
 * What a read gives, or the code it threw.
 * @param {function(): *} read - The read.
 * @returns {Promise<*>} The value, or `{ value: undefined, error }`.
 */
const settled = async (read) => {
	try {
		return { value: await read(), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
};

describe.each(configs)("module-private members > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the base fixture.
	 * @param {object} [privateConfig] - `permissions.private`.
	 * @returns {Promise<object>} The api.
	 */
	const build = (privateConfig) =>
		slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: [], ...(privateConfig ? { private: privateConfig } : {}) }
		});

	describe("the default: private to the module that owns the member", () => {
		it("every file of the base folder reads it, in its own folder, a subfolder and another folder; the host is refused", async () => {
			const internals = await plain(`${BASE}/billing/internals.mjs`);
			api = await build();
			const own = { value: internals.__rate, error: null };
			expect(await api.billing.reader.read("billing.internals.__rate")).toEqual(own);
			expect(await api.billing.deep.reader.read("billing.internals.__rate")).toEqual(own);
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual(own);
			expect(await api.reporting.reader.read("billing.internals._fee")).toEqual({ value: internals._fee, error: null });
			expect(await settled(() => api.billing.internals.__rate)).toEqual(DENIED);
		});

		it("an add with a moduleID reads its own members in every folder, and neither it nor the base reads the other's", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build();
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			expect(await api.ext.reader.read("ext.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.ext.sub.reader.read("ext.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.billing.reader.read("ext.vault.__key")).toEqual(DENIED);
			expect(await api.ext.reader.read("billing.internals.__rate")).toEqual(DENIED);
		});

		it("an add with a generated moduleID is a module of its own", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build();
			await api.slothlet.api.add("ext", EXT);
			expect(await api.ext.sub.reader.read("ext.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.reporting.reader.read("ext.vault.__key")).toEqual(DENIED);
		});

		it("a later add that takes over a member's path owns it there: its files read it, the base module's do not", async () => {
			const layer = await plain(`${LAYER}/internals.mjs`);
			api = await build();
			await api.billing.reader.read("billing.internals.__rate");
			await api.slothlet.api.add("billing", LAYER, { moduleID: "layer", forceOverwrite: true });
			expect(await api.billing.lreader.read("billing.internals.__rate")).toEqual({ value: layer.__rate, error: null });
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual(DENIED);
		});

		it("a scoped remove of one of a module's mounts leaves its other mount reading its members", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build();
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.add("ext2", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.remove("ext");
			expect(api.ext).toBeUndefined();
			expect(await api.ext2.sub.reader.read("ext2.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.billing.reader.read("ext2.vault.__key")).toEqual(DENIED);
		});

		it("keeps the same answers across a reload of the add and of the base", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			const internals = await plain(`${BASE}/billing/internals.mjs`);
			api = await build();
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.reload("ext-mod");
			expect(await api.ext.sub.reader.read("ext.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.billing.reader.read("ext.vault.__key")).toEqual(DENIED);
			await api.slothlet.reload();
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual({ value: internals.__rate, error: null });
			expect(await api.ext.reader.read("billing.internals.__rate")).toEqual(DENIED);
		});

		it("an in-memory object leaf is its own module: it reads its own member, other modules do not", async () => {
			api = await build();
			await api.slothlet.api.add("obj", { _secret: 42, read: () => self.obj._secret }, { moduleID: "obj-mod" });
			expect(await settled(() => api.obj.read())).toEqual({ value: 42, error: null });
			expect(await api.billing.reader.read("obj._secret")).toEqual(DENIED);
			expect(await settled(() => api.obj._secret)).toEqual(DENIED);
		});

		it("another module is refused, audited like any denial, and no allow rule naming the member grants it", async () => {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: {
					defaultPolicy: "deny",
					attribution,
					rules: [
						{ caller: "**", target: "billing.internals.__rate", effect: "allow" },
						{ caller: "**", target: "**", effect: "allow" }
					]
				}
			});
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			const denials = [];
			api.slothlet.lifecycle.on("permission:denied", (payload) => denials.push(payload));
			expect(await api.ext.reader.read("billing.internals.__rate")).toEqual(DENIED);
			expect(denials.some((d) => d.target === "billing.internals.__rate")).toBe(true);
		});

		it("a supplied caller of another module is refused even under private.host allow", async () => {
			api = await build({ host: "allow" });
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			// A silent query answers for leaves that have loaded (lazy mode loads a folder on its first read).
			await api.billing.reader.read("billing.internals.currency");
			await api.ext.reader.read("ext.vault.name");
			const { checkCall } = api.slothlet.permissions.global;
			expect(checkCall("billing.reader.read", "billing.internals.__rate")).toBe(true);
			expect(checkCall("ext.reader.read", "billing.internals.__rate")).toBe(false);
		});

		it("the host reads private members when permissions.private.host allows it", async () => {
			const internals = await plain(`${BASE}/billing/internals.mjs`);
			api = await build({ host: "allow" });
			expect(await settled(() => api.billing.internals.__rate)).toEqual({ value: internals.__rate, error: null });
		});
	});

	describe('scope "folder": private to the folder of files that exports the member', () => {
		it("only files of the member's own folder read it; a subfolder, another folder and the host are refused", async () => {
			const internals = await plain(`${BASE}/billing/internals.mjs`);
			api = await build({ scope: "folder" });
			expect(await api.billing.reader.read("billing.internals.__rate")).toEqual({ value: internals.__rate, error: null });
			expect(await api.billing.deep.reader.read("billing.internals.__rate")).toEqual(DENIED);
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual(DENIED);
			expect(await settled(() => api.billing.internals.__rate)).toEqual(DENIED);
		});

		it("an add's own folder reads its members, its subfolder and other modules do not, with a given or a generated moduleID", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build({ scope: "folder" });
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.add("ext2", EXT);
			for (const at of ["ext", "ext2"]) {
				expect(await api[at].reader.read(`${at}.vault.__key`)).toEqual({ value: vault.__key, error: null });
				expect(await api[at].sub.reader.read(`${at}.vault.__key`)).toEqual(DENIED);
				expect(await api.billing.reader.read(`${at}.vault.__key`)).toEqual(DENIED);
			}
		});

		it("a later add that takes over a member's path: its own folder reads it, the base module's folders do not", async () => {
			const layer = await plain(`${LAYER}/internals.mjs`);
			api = await build({ scope: "folder" });
			await api.billing.reader.read("billing.internals.__rate");
			await api.slothlet.api.add("billing", LAYER, { moduleID: "layer", forceOverwrite: true });
			expect(await api.billing.lreader.read("billing.internals.__rate")).toEqual({ value: layer.__rate, error: null });
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual(DENIED);
		});

		it("a scoped remove of one of a module's mounts leaves its other mount's folder reading its members", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build({ scope: "folder" });
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.add("ext2", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.remove("ext");
			expect(await api.ext2.reader.read("ext2.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.ext2.sub.reader.read("ext2.vault.__key")).toEqual(DENIED);
		});

		it("keeps the same answers across a reload of the add and of the base", async () => {
			const vault = await plain(`${EXT}/vault.mjs`);
			api = await build({ scope: "folder" });
			await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
			await api.slothlet.api.reload("ext-mod");
			expect(await api.ext.reader.read("ext.vault.__key")).toEqual({ value: vault.__key, error: null });
			expect(await api.ext.sub.reader.read("ext.vault.__key")).toEqual(DENIED);
			await api.slothlet.reload();
			expect(await api.reporting.reader.read("billing.internals.__rate")).toEqual(DENIED);
		});

		it("an in-memory object leaf has no folder: other modules are refused its member", async () => {
			api = await build({ scope: "folder" });
			await api.slothlet.api.add("obj", { _secret: 42, read: () => self.obj._secret }, { moduleID: "obj-mod" });
			expect(await api.billing.reader.read("obj._secret")).toEqual(DENIED);
			expect(await settled(() => api.obj._secret)).toEqual(DENIED);
		});
	});

	describe("under either scope: a folder's name says nothing about its module", () => {
		it.each([
			["the default", undefined],
			['"module"', { scope: "module" }],
			['"folder"', { scope: "folder" }]
		])(
			"%s: another module's folder named like the base's billing folder and the base's billing folder do not read each other's members",
			async (_label, privateConfig) => {
				const own = await plain(`${BASE}/billing/internals.mjs`);
				const twin = await plain(`${TWIN}/billing/internals.mjs`);
				api = await build(privateConfig);
				await api.slothlet.api.add("twin", TWIN, { moduleID: "twin-mod" });
				await api.slothlet.api.add("twin2", TWIN);
				// Each folder still reads its own module's member, so the refusals below are about the module, not the read.
				expect(await api.billing.reader.read("billing.internals.__rate")).toEqual({ value: own.__rate, error: null });
				for (const at of ["twin", "twin2"]) {
					expect(await api[at].billing.reader.read(`${at}.billing.internals.__rate`)).toEqual({ value: twin.__rate, error: null });
					expect(await api[at].billing.reader.read("billing.internals.__rate")).toEqual(DENIED);
					expect(await api.billing.reader.read(`${at}.billing.internals.__rate`)).toEqual(DENIED);
				}
			}
		);
	});
});

describe("permissions.private.scope validation", () => {
	it.each([["files"], [""], [1], [null], [true]])("refuses %j with INVALID_CONFIG", async (scope) => {
		await expect(slothlet({ base: BASE, silent: true, permissions: { private: { scope } } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it.each(["module", "folder"])('accepts "%s"', async (scope) => {
		const api = await slothlet({ base: BASE, silent: true, permissions: { private: { scope } } });
		await api.shutdown();
	});
});
