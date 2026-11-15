/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-root-integrity.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Defining, deleting, assigning, closing (`Object.preventExtensions` / `seal` / `freeze`) and setting the
 * prototype of the api root act on the api, as on an object, and module code making them is held to the rules the same
 * change at a node is held to.
 *
 * @description
 * Each of three roots (a folder of files, one whose root file's default export is a function, and one whose root file's
 * default export is an async function) is loaded as the api and mounted again at `zz`, so the root has a twin one level
 * down, and a `writer` module is mounted at `w`, where it owns neither. The writer makes each change through the api the
 * host handed it and through `self.slothlet.diag.getAPI()`, to `zz` and to the root of a fresh instance, and the root's
 * answer must be the twin's: with no write rule, with write rules granting each member, with the permission system off
 * and with it disabled. The host's own changes are checked against a plain object's. Eager and lazy mode, the async and
 * live runtime, both attributions.
 * @module tests/vitests/suites/proxies/api-root-integrity
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_root_integrity");

const ROOTS = ["objroot", "fnroot", "asyncroot"];
const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const configs = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

/** The changes the writer makes that the twin answers as the root must. */
const TWIN_CHANGES = ["set", "setSymbol", "define", "defineFixed", "delete"];

/** The changes that close a node. */
const CLOSING_CHANGES = ["freeze", "seal", "preventExtensions"];

/** The members of each root the fixture makes, and the ones a change adds. */
const NAMES = ["data", "pnum", "tool", "rnum", "wset", "wdef", "wfix", "w", "zz"];

/** A member name a write rule names, at the root (`""`) or at the twin (`"zz."`). */
const WRITTEN = ["wset", "wdef", "wfix", "data"];

/**
 * The permission configs: rules written for both the root's members and their twins.
 * @type {Record<string, function(string): (object|undefined)>}
 */
const PERMISSIONS = {
	"no write rule": (attribution) => ({ defaultPolicy: "allow", attribution, rules: [] }),
	"write rules granting each member": (attribution) => ({
		defaultPolicy: "allow",
		attribution,
		rules: ["", "zz."].flatMap((prefix) =>
			WRITTEN.map((member) => ({ caller: "w.**", target: `${prefix}${member}:write`, effect: "allow" }))
		)
	}),
	"the permission system off": () => undefined,
	"the permission system disabled": () => ({ mode: "disabled" })
};

/**
 * Build an instance over a root, with the same folder mounted again at `zz` and the writer at `w`.
 * @param {string} root - The root's folder.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build(root, options) {
	const api = await slothlet({ base: join(FIXTURE, root), silent: true, diagnostics: true, ...options });
	await api.slothlet.api.add("zz", join(FIXTURE, root), { moduleID: "zz" });
	await api.slothlet.api.add("w", join(FIXTURE, "writer"), { moduleID: "w" });
	for (const member of ["data", "pnum", "tool"]) {
		await api[member];
		await api.zz[member];
	}
	await api.w.ops;
	return api;
}

/**
 * The fixture's member names a node lists.
 * @param {object} node - The node.
 * @returns {string[]} The names.
 */
const listed = (node) => Reflect.ownKeys(node).filter((key) => NAMES.includes(key) && key !== "zz" && key !== "w");

describe.each(ROOTS)("the api root's integrity > %s", (root) => {
	describe.each(configs)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		describe.each(Object.keys(PERMISSIONS))("%s", (name) => {
			const permissions = PERMISSIONS[name](attribution);

			it.each(TWIN_CHANGES.flatMap((change) => ["given", "api"].map((via) => [change, via])))(
				"a module's %s through the %s api answers at the root as at its twin one level down",
				async (change, via) => {
					api = await build(root, { mode, runtime, permissions });
					const twin = api.w.ops.change(change, via, "zz", api);
					const atRoot = api.w.ops.change(change, via, "", api);
					expect(atRoot).toEqual(twin);
					// The root is left holding what the twin holds.
					expect(listed(api).sort()).toEqual(listed(api.zz).sort());
					expect(Object.isExtensible(api)).toBe(Object.isExtensible(api.zz));
				}
			);

			it.each(CLOSING_CHANGES.flatMap((change) => ["given", "api"].map((via) => [change, via])))(
				"a module's %s through the %s api is refused at the root, which holds slothlet's own members, and leaves it open",
				async (change, via) => {
					api = await build(root, { mode, runtime, permissions });
					const twin = api.w.ops.change(change, via, "zz", api);
					const atRoot = api.w.ops.change(change, via, "", api);
					// Refused as at the twin where the twin is refused, and otherwise as a change to slothlet's root function is.
					expect(atRoot).toEqual("threw" in twin ? twin : api.w.ops.change("setReserved", "self", ""));
					expect(Object.isExtensible(api)).toBe(true);
					expect(typeof api.shutdown).toBe("function");
				}
			);

			it("a module assigning slothlet's own root function through the api it was handed is refused as through `self`", async () => {
				api = await build(root, { mode, runtime, permissions });
				expect(api.w.ops.change("setReserved", "given", "", api)).toEqual(api.w.ops.change("setReserved", "self", ""));
				expect(typeof api.shutdown).toBe("function");
			});

			it("a module setting the root's prototype is refused as at its twin, and otherwise sets it as on an object", async () => {
				api = await build(root, { mode, runtime, permissions });
				const twin = api.w.ops.change("setPrototypeOf", "given", "zz", api);
				const atRoot = api.w.ops.change("setPrototypeOf", "given", "", api);
				if ("threw" in twin) expect(atRoot).toEqual(twin);
				// A function root's prototype is its module's function's, which is left unchanged: the change is refused.
				else expect(atRoot).toEqual(root === "objroot" ? { same: true, inherited: 5 } : { threw: "TypeError" });
			});
		});

		describe("the host's own changes", () => {
			it("defines a member on the api, as on an object", async () => {
				api = await build(root, { mode, runtime });
				const plain = {};
				for (const target of [plain, api]) {
					Object.defineProperty(target, "wdef", { value: 2, writable: true, enumerable: true, configurable: true });
					Object.defineProperty(target, "wfix", { value: 3, writable: false, enumerable: false, configurable: false });
				}
				expect(api.wdef).toBe(2);
				expect(api.wfix).toBe(3);
				expect(Object.keys(api)).toContain("wdef");
				expect(Object.keys(api)).not.toContain("wfix");
				expect(Reflect.ownKeys(api)).toContain("wfix");
				expect(Object.getOwnPropertyDescriptor(api, "wdef")).toEqual(Object.getOwnPropertyDescriptor(plain, "wdef"));
				expect(Object.getOwnPropertyDescriptor(api, "wfix")).toEqual(Object.getOwnPropertyDescriptor(plain, "wfix"));
				expect(Reflect.set(api, "wfix", 4)).toBe(false);
				expect(delete api.wdef).toBe(true);
				expect("wdef" in api).toBe(false);
				expect(Reflect.deleteProperty(api, "wfix")).toBe(false);
			});

			it("freezes the root as an object, leaving its members, slothlet's namespace and every prototype open", async () => {
				api = await build(root, { mode, runtime });
				const before = Reflect.ownKeys(api);
				const data = api.data;
				expect(Object.freeze(api)).toBe(api);
				expect(Object.isFrozen(api)).toBe(true);
				expect(Object.isExtensible(api)).toBe(false);
				// It lists, describes and reads what it held.
				expect(Reflect.ownKeys(api)).toEqual(expect.arrayContaining(before));
				for (const key of before) {
					const descriptor = Object.getOwnPropertyDescriptor(api, key);
					expect(descriptor.configurable, String(key)).toBe(false);
					if ("value" in descriptor) expect(descriptor.writable, String(key)).toBe(false);
				}
				expect(api.data).toBe(data);
				expect(api.data.a).toBe(1);
				expect(api.pnum).toBe(7);
				expect(api.tool.run()).toBe("run");
				if (root !== "objroot") expect(await api()).toBe("root");
				// Nothing is added, changed or removed.
				expect(Reflect.set(api, "wset", 1)).toBe(false);
				expect(Reflect.set(api, "data", 1)).toBe(false);
				expect(Reflect.deleteProperty(api, "data")).toBe(false);
				expect(Reflect.defineProperty(api, "wdef", { value: 2 })).toBe(false);
				expect(Reflect.setPrototypeOf(api, {})).toBe(false);
				expect(api.data).toBe(data);
				// Freezing again changes nothing.
				expect(Object.isFrozen(Object.freeze(api))).toBe(true);
				// Only the root: its members, slothlet's namespace and the prototypes stay as they were.
				expect(Object.isFrozen(api.data)).toBe(false);
				expect(Object.isFrozen(api.slothlet)).toBe(false);
				expect(Object.isFrozen(api.slothlet.api)).toBe(false);
				for (const prototype of [Object.prototype, Function.prototype, Object.getPrototypeOf(async () => {})]) {
					expect(Object.isFrozen(prototype)).toBe(false);
					expect(Object.isExtensible(prototype)).toBe(true);
				}
				expect(Object.getPrototypeOf(api)).toBe(
					root === "objroot" ? Object.prototype : Object.getPrototypeOf(root === "fnroot" ? function () {} : async () => {})
				);
				// A member's own subtree still changes, the framework's work under it included.
				await api.slothlet.api.add("zz.more", join(FIXTURE, root, "data.mjs"), { moduleID: "more" });
				expect(api.zz.more.a).toBe(1);
				// A member the root did not hold is not added, as on a frozen node.
				await expect(api.slothlet.api.add("extra", join(FIXTURE, root, "data.mjs"), { moduleID: "extra" })).rejects.toMatchObject({
					code: "API_ROOT_CLOSED"
				});
				expect("extra" in api).toBe(false);
			});

			it("seals the root, which keeps taking new values for its members", async () => {
				api = await build(root, { mode, runtime });
				Object.seal(api);
				expect(Object.isSealed(api)).toBe(true);
				expect(Object.isFrozen(api)).toBe(false);
				api.data = 5;
				expect(api.data).toBe(5);
				expect(Object.getOwnPropertyDescriptor(api, "data")).toEqual({ value: 5, writable: true, enumerable: true, configurable: false });
				expect(Reflect.deleteProperty(api, "data")).toBe(false);
				expect(Reflect.set(api, "wset", 1)).toBe(false);
				expect("wset" in api).toBe(false);
			});

			it("closes the root to new members, which can still be deleted", async () => {
				api = await build(root, { mode, runtime });
				Object.preventExtensions(api);
				expect(Object.isExtensible(api)).toBe(false);
				expect(Reflect.set(api, "wset", 1)).toBe(false);
				expect(delete api.data).toBe(true);
				expect("data" in api).toBe(false);
				expect(Reflect.ownKeys(api)).not.toContain("data");
				expect(api.pnum).toBe(7);
			});

			it("sets an object root's prototype, as on an object, and refuses to change a function root's", async () => {
				api = await build(root, { mode, runtime });
				const prototype = { inherited: 5 };
				if (root !== "objroot") {
					const before = Object.getPrototypeOf(api);
					expect(Reflect.setPrototypeOf(api, prototype)).toBe(false);
					expect(Reflect.setPrototypeOf(api, before)).toBe(true);
					expect(Object.getPrototypeOf(api)).toBe(before);
					return;
				}
				Object.setPrototypeOf(api, prototype);
				expect(Object.getPrototypeOf(api)).toBe(prototype);
				expect(api.inherited).toBe(5);
				expect("inherited" in api).toBe(true);
				expect(Object.keys(api)).not.toContain("inherited");
			});

			it("refuses a reload of a closed root, which cannot take the members a rebuild makes, and still shuts down", async () => {
				api = await build(root, { mode, runtime });
				Object.freeze(api);
				await expect(api.slothlet.reload()).rejects.toMatchObject({ code: "API_ROOT_CLOSED" });
				await expect(api.slothlet.restart()).rejects.toMatchObject({ code: "API_ROOT_CLOSED" });
				expect(api.data.a).toBe(1);
				await api.shutdown();
				api = null;
			});
		});
	});
});
