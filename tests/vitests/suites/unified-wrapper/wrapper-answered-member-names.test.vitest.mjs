/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/wrapper-answered-member-names.test.vitest.mjs
 *	@Date: 2026-10-07T00:00:00-07:00 (1791356400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T22:21:55-07:00 (1791523315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A namespace member named like a function property (`name`, `length`) is reachable (#571).
 *
 * @description
 * The api node answers `name` (last path segment) and `length` (arity) itself when it has no member
 * of that name, and a function proxy target has its own `prototype`. Those answers hid real members: a folder `session/name/` crashed the eager build
 * (`Cannot create property 'set' on string 'session'`), was unreachable in lazy mode until `session`
 * had loaded, and `api.add()` refused to mount at `<namespace>.name`. A primitive member still
 * cannot be nested under.
 *
 * Fixture (`api_test_wrapper_prop_members`):
 * ```
 * session/name/set.mjs     → api.session.name.set()   → "session.name.set"
 * session/length/get.mjs   → api.session.length.get() → "session.length.get"
 * session/prototype/get.mjs → api.session.prototype.get() → "session.prototype.get"
 * session/info.mjs         → api.session.info()       → "session.info"
 * account/name.mjs         → api.account.name.set()   → "account.name.set"
 * profile/bio.mjs          → api.profile.bio()        → "profile.bio"
 * label.mjs                → api.label.name           → "label-name" (primitive export)
 * ```
 *
 * @module tests/vitests/suites/unified-wrapper/wrapper-answered-member-names
 */

import { describe, it, expect, afterEach } from "vitest";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { readApiMember, loadApiMember, resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("wrapper-answered names as namespace members (#571) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the fixture with the matrix config.
	 * @returns {Promise<object>} The composed api.
	 */
	const compose = () => slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });

	it("composes a folder named `name` under a namespace and reaches it without loading the parent first", async () => {
		api = await compose();
		expect(await api.session.name.set()).toBe("session.name.set");
	});

	it("reaches a same-named folder nested in a folder named `name` without loading that folder first", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_NESTED });
		// Load `x` only: `x.name` is then a real folder node that has not loaded, and must answer its
		// `name` child rather than its own name.
		await api.x;
		expect(await api.x.name.name.get()).toBe("x.name.name.get");
		expect(await api.x.name.info()).toBe("x.name.info");
	});

	it("reaches a folder named `length` under a namespace", async () => {
		api = await compose();
		expect(await api.session.length.get()).toBe("session.length.get");
	});

	it("keeps the siblings of those folders reachable", async () => {
		api = await compose();
		expect(await api.session.info()).toBe("session.info");
		expect(await api.session.name.set()).toBe("session.name.set");
	});

	it("reaches a file named `name` under a namespace", async () => {
		api = await compose();
		expect(await api.account.name.set()).toBe("account.name.set");
		expect(await api.account.name.get()).toBe("account.name.get");
	});

	it("mounts with api.add at <namespace>.name and <namespace>.length", async () => {
		api = await compose();
		await api.slothlet.api.add("profile.name", TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT);
		await api.slothlet.api.add("profile.length", TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT);
		expect(await api.profile.name.set()).toBe("mounted.set");
		expect(await api.profile.length.set()).toBe("mounted.set");
		expect(await api.profile.bio()).toBe("profile.bio");
	});

	it("mounts with api.add below <namespace>.name", async () => {
		api = await compose();
		await api.slothlet.api.add("profile.name.deep", TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT);
		expect(await api.profile.name.deep.set()).toBe("mounted.set");
	});

	it("refuses to mount below a primitive `name` member", async () => {
		api = await compose();
		expect(api.label.name).toBe("label-name");
		await expect(api.slothlet.api.add("label.name.deep", TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT)).rejects.toThrow(
			"INVALID_CONFIG_API_PATH_INVALID"
		);
		expect(api.label.name).toBe("label-name");
	});

	it("reaches a folder named `prototype` under a namespace", async () => {
		api = await compose();
		expect(await api.session.prototype.get()).toBe("session.prototype.get");
	});

	it("keeps a callable node's own `prototype` when it has no such member", async () => {
		api = await compose();
		expect(await api.session.info()).toBe("session.info");
		const proto = api.session.info.prototype;
		expect(proto === undefined || typeof proto === "object").toBe(true);
		expect(api.profile.prototype === undefined || typeof api.profile.prototype === "object").toBe(true);
	});

	it("answers `name` itself again once a `name` member is removed", async () => {
		api = await compose();
		expect(await api.session.name.set()).toBe("session.name.set");
		await api.slothlet.api.remove("session.name");
		expect(api.session.name).toBe("session");
		expect(await api.session.info()).toBe("session.info");
	});

	it("still answers `name` and `length` itself for a namespace without such a member", async () => {
		api = await compose();
		// Loads the namespace in lazy mode; a no-op in eager mode.
		expect(await api.profile.bio()).toBe("profile.bio");
		expect(api.profile.name).toBe("profile");
		expect(api.profile.length).toBe(0);
	});

	it("still answers `name` for a callable as its last path segment", async () => {
		api = await compose();
		// Call first: an unloaded lazy leaf is still a waiting proxy, which has its own `name`.
		expect(await api.session.info()).toBe("session.info");
		expect(await api.session.name.set()).toBe("session.name.set");
		expect(api.session.info.name).toBe("info");
		expect(api.session.name.set.name).toBe("set");
	});
});

describe("readApiMember / loadApiMember (#571)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("reads a member, and nothing for a name the node only answers itself", async () => {
		api = await slothlet({ mode: "eager", base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		expect(readApiMember(api.profile, "name")).toBeUndefined();
		expect(readApiMember(api.profile, "length")).toBeUndefined();
		expect(readApiMember(api.label, "name")).toBe("label-name");
		expect(typeof readApiMember(api.profile, "bio")).toBe("function");
		expect(readApiMember({ name: "plain" }, "name")).toBe("plain");
	});

	it("returns an unloaded lazy node's own answer, and loads it only through loadApiMember", async () => {
		api = await slothlet({ mode: "lazy", base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		// Its exports are unknown until it loads, so the node's own answer is returned as-is.
		expect(readApiMember(api.profile, "name")).toBe("profile");
		expect(await loadApiMember(api.profile, "name")).toBeUndefined();
		expect(readApiMember(api.profile, "name")).toBeUndefined();
	});
});

describe.each(getMatrixConfigs())("names that cannot be api members are refused by name (#571) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose a fixture and touch the refused branch, so lazy mode reaches it too.
	 * @param {string} base - Fixture directory.
	 * @returns {Promise<void>}
	 */
	const composeAndTouch = async (base) => {
		api = await slothlet({ ...config, base });
		await api.session;
	};

	it("refuses a file named `then`", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_THEN_FILE)).rejects.toThrow(/MODULE_THENABLE_NAME/);
	});

	it("refuses a folder named `then`", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_THEN_FOLDER)).rejects.toThrow(/MODULE_THENABLE_NAME/);
	});

	it("refuses a folder named for a framework-reserved key", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_RESERVED_FOLDER)).rejects.toThrow(/MODULE_RESERVED_DIRNAME/);
	});

	it("refuses a folder whose name sanitizes to a framework-reserved key", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_RESERVED_FOLDER_SANITIZED)).rejects.toThrow(/MODULE_RESERVED_DIRNAME/);
	});

	it("refuses a file whose name sanitizes to a framework-reserved key", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_RESERVED_FILE_SANITIZED)).rejects.toThrow(/MODULE_RESERVED_FILENAME/);
	});

	it("refuses a CommonJS module exporting `then` instead of hanging the load", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_THEN_EXPORT_CJS)).rejects.toThrow(/MODULE_RESERVED_EXPORT/);
	});

	it("refuses a `then` export reaching export extraction", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		const loader = resolveWrapper(api.profile).slothlet.processors.loader;
		expect(() => loader.extractExports({ then() {}, other() {} })).toThrow(/MODULE_RESERVED_EXPORT/);
	});

	it("refuses a default object with a `then` member", async () => {
		await expect(composeAndTouch(TEST_DIRS.API_TEST_REJECT_THEN_DEFAULT)).rejects.toThrow(/MODULE_RESERVED_EXPORT/);
	});

	it("refuses a `then` member on every synthetic export shape", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		const then = () => "unreachable";
		const get = () => "svc.get";
		// A named export, a default object's own member, and a member of a nested object export.
		for (const exports of [{ then, get }, { default: { then, get } }, { store: { then, get } }]) {
			await expect(api.slothlet.api.add("svc", { exports })).rejects.toThrow(/MODULE_RESERVED_EXPORT/);
		}
		expect(await api.profile.bio()).toBe("profile.bio");
	});

	it("refuses an api.add path with a `then` segment, as a string or an array", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		await expect(api.slothlet.api.add("profile.then", TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT)).rejects.toThrow(/then/);
		await expect(api.slothlet.api.add(["profile", "then", "deep"], TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_MOUNT)).rejects.toThrow(
			/INVALID_CONFIG_API_PATH_INVALID/
		);
		expect(await api.profile.bio()).toBe("profile.bio");
	});
});

describe("browser manifests refuse the same folder and file names (#571)", () => {
	/**
	 * Compose from an inline manifest over the browser fixture.
	 * @param {object} manifest - Manifest with the entry under test.
	 * @returns {Promise<object>} The composed api.
	 */
	const composeManifest = (manifest) => slothlet({ base: TEST_DIRS.API_TEST_BROWSER, mode: "eager", manifest });
	const math = { path: "math.mjs", name: "math", fullName: "math.mjs" };
	const folder = (name) => ({
		path: name,
		name,
		files: [{ path: `${name}/format.mjs`, name: "format", fullName: "format.mjs" }],
		directories: []
	});

	it("refuses a `then` file", async () => {
		await expect(
			composeManifest({ files: [math, { path: "then.mjs", name: "then", fullName: "then.mjs" }], directories: [] })
		).rejects.toThrow(/MODULE_THENABLE_NAME/);
	});

	it("refuses folder and file names that sanitize to `then` or a framework-reserved key", async () => {
		await expect(composeManifest({ files: [math], directories: [folder("Then")] })).rejects.toThrow(/MODULE_THENABLE_NAME/);
		await expect(composeManifest({ files: [math], directories: [folder("_materialize-")] })).rejects.toThrow(/MODULE_RESERVED_DIRNAME/);
		await expect(
			composeManifest({ files: [math, { path: "-_impl.mjs", name: "-_impl", fullName: "-_impl.mjs" }], directories: [] })
		).rejects.toThrow(/MODULE_RESERVED_FILENAME/);
	});

	it("refuses a `then` folder and a framework-reserved folder", async () => {
		await expect(composeManifest({ files: [math], directories: [folder("then")] })).rejects.toThrow(/MODULE_THENABLE_NAME/);
		await expect(composeManifest({ files: [math], directories: [folder("_materialize")] })).rejects.toThrow(/MODULE_RESERVED_DIRNAME/);
	});
});

describe("UnifiedWrapper.___resetLazy carries the fresh folder's member names (#571 review)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("replaces the member names along with the materializer", async () => {
		api = await slothlet({ mode: "lazy", base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS });
		const session = resolveWrapper(api.session);
		expect(api.session.name).not.toBe("session");
		session.___resetLazy(async () => ({ info: () => "reset" }), []);
		// The reset folder has no `name` entry, so the unloaded node answers `name` itself.
		expect(api.session.name).toBe("session");
		session.___resetLazy(async () => ({ name: { set: () => "reset" } }), ["name"]);
		expect(api.session.name).not.toBe("session");
	});
});

describe.each(getMatrixConfigs())("a reload that adds a `name` / `length` member reaches it (#593) > $name", ({ config, name }) => {
	let api;
	let scratchDir;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
		scratchDir = null;
	});

	it("api.slothlet.api.reload() picks up session/name/ and session/length/ added on disk", async () => {
		scratchDir = path.join(process.cwd(), "tmp", `wrapper-answered-reload-593-${name.replace(/[^a-z0-9]+/gi, "-")}`);
		rmSync(scratchDir, { recursive: true, force: true });
		cpSync(TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS, scratchDir, { recursive: true });
		const held = path.join(scratchDir, "..", `${path.basename(scratchDir)}-held`);
		rmSync(held, { recursive: true, force: true });
		cpSync(path.join(scratchDir, "session"), held, { recursive: true });
		try {
			rmSync(path.join(scratchDir, "session", "name"), { recursive: true, force: true });
			rmSync(path.join(scratchDir, "session", "length"), { recursive: true, force: true });

			api = await slothlet({ ...config, base: scratchDir });
			expect(api.session.name).toBe("session");

			cpSync(path.join(held, "name"), path.join(scratchDir, "session", "name"), { recursive: true });
			cpSync(path.join(held, "length"), path.join(scratchDir, "session", "length"), { recursive: true });
			await api.slothlet.api.reload("session");

			expect(await api.session.name.set()).toBe("session.name.set");
			expect(await api.session.length.get()).toBe("session.length.get");
		} finally {
			rmSync(held, { recursive: true, force: true });
		}
	});
});
