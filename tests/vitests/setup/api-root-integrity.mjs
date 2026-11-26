/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/api-root-integrity.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:19-08:00 (1794882619)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared body of the api-root-integrity tests: defining, deleting, assigning, closing
 * (`Object.preventExtensions` / `seal` / `freeze`) and setting the prototype of the api root act on the api, as on an
 * object, and module code making them is held to the rules the same change at a node is held to.
 *
 * @description
 * Each of three roots (a folder of files, one whose root file's default export is a function, and one whose root file's
 * default export is an async function) is loaded as the api and mounted again at `zz`, so the root has a twin one level
 * down, and a `writer` module is mounted at `w`, where it owns neither. The writer makes each change through the api the
 * host handed it and through `self.slothlet.diag.api()`, to `zz` and to the root of a fresh instance, and the root's
 * answer must be the twin's: with no write rule, with write rules granting each member, with the permission system off
 * and with it disabled. The host's own changes are checked against a plain object's. Eager and lazy mode, the async and
 * live runtime, both attributions.
 *
 * The cases are spread over the `suites/proxies/api-root-integrity-*.test.vitest.mjs` files by root and mode (see
 * {@link describeApiRootIntegrity}) so each file finishes in a few minutes; together they run every case the single
 * file ran.
 * @module tests/vitests/setup/api-root-integrity
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
	"no write rule": (attribution) => ({ policy: "allow", caller: { attribution }, rules: [] }),
	"write rules granting each member": (attribution) => ({
		policy: "allow",
		caller: {
			attribution
		},
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
	await api.slothlet.api.add("zz", join(FIXTURE, root), { id: "zz" });
	await api.slothlet.api.add("w", join(FIXTURE, "writer"), { id: "w" });
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

/**
 * The names `for…in` lists that the value does not hold itself.
 * @param {object|Function} value - The value.
 * @returns {string[]} The inherited names.
 */
function inheritedNames(value) {
	const own = Object.keys(value);
	const names = [];
	for (const name in value) if (!own.includes(name)) names.push(name);
	return names;
}

/**
 * Give a function a prototype, then none, then its first one back, answering what each step shows.
 * @param {Function} value - A plain function, or the api root standing for one.
 * @returns {object} What it showed.
 */
function observePrototype(value) {
	const key = Symbol.for("slothlet-root-prototype");
	const prototype = {
		inherited: 5,
		get viaThis() {
			return this.inherited + 1;
		},
		hello() {
			return "hi";
		},
		me() {
			return this;
		},
		[key]: 7,
		name: "shadowed"
	};
	const first = Object.getPrototypeOf(value);
	const own = Object.keys(value).join();
	const shown = { firstDunder: value.__proto__ === first, firstKind: [value instanceof Function, typeof value.call] };
	shown.set = Reflect.setPrototypeOf(value, prototype);
	shown.reported = [Object.getPrototypeOf(value) === prototype, value.__proto__ === prototype];
	shown.reads = [value.inherited, value.viaThis, value[key], value.hello(), value.me() === value];
	shown.has = ["inherited" in value, key in value, "missing" in value, "toString" in value, "call" in value];
	shown.ownWins = value.name;
	shown.notOwn = [Object.keys(value).join() === own, Object.hasOwn(value, "inherited"), Object.getOwnPropertyDescriptor(value, "hello")];
	shown.forIn = inheritedNames(value);
	shown.kind = [typeof value, value instanceof Object, value instanceof Function, typeof value.toString, typeof value.call, String(value)];
	shown.setNull = Reflect.setPrototypeOf(value, null);
	shown.none = [
		Object.getPrototypeOf(value),
		value.__proto__,
		value.inherited,
		value.toString,
		value.constructor,
		value.call,
		"toString" in value,
		value instanceof Object,
		typeof value,
		inheritedNames(value)
	];
	shown.setBack = Reflect.setPrototypeOf(value, first);
	shown.back = [
		Object.getPrototypeOf(value) === first,
		value.inherited,
		typeof value.toString,
		typeof value.call,
		value instanceof Function
	];
	return shown;
}

/**
 * Give a function a prototype and close it, answering what the closed function shows and takes.
 * @param {Function} value - A plain function, or the api root standing for one.
 * @param {"seal"|"freeze"|"preventExtensions"} how - How it is closed.
 * @returns {object} What it showed.
 */
function observeClosedPrototype(value, how) {
	const prototype = { inherited: 5 };
	Object.setPrototypeOf(value, prototype);
	Object[how](value);
	// A closed root reports a checked view of the prototype it was given, to the host too, so the two are compared by
	// what the reported prototype holds rather than by identity.
	return {
		reported: [Object.getPrototypeOf(value).inherited, value.__proto__.inherited, Object.getPrototypeOf(value) === value.__proto__],
		reads: [value.inherited, "inherited" in value, inheritedNames(value)],
		another: [Reflect.setPrototypeOf(value, {}), Reflect.setPrototypeOf(value, null), Reflect.setPrototypeOf(value, Function.prototype)],
		same: Reflect.setPrototypeOf(value, Object.getPrototypeOf(value)),
		still: [Object.getPrototypeOf(value).inherited, value.inherited]
	};
}

/**
 * Register the api-root-integrity cases for the roots and configs a test file runs.
 * @param {object} options - What to run.
 * @param {string[]} options.roots - Entries of the fixture's roots: `"objroot"`, `"fnroot"`, `"asyncroot"`.
 * @param {string[]} [options.modes=["eager", "lazy"]] - The modes.
 * @param {string[]} [options.runtimes=["async", "live"]] - The runtimes.
 * @returns {void}
 * @example
 * describeApiRootIntegrity({ roots: ["objroot"], modes: ["eager"] });
 */
export function describeApiRootIntegrity({ roots, modes = MODES, runtimes = RUNTIMES }) {
	const selected = configs.filter((config) => modes.includes(config.mode) && runtimes.includes(config.runtime));
	describe.each(ROOTS.filter((root) => roots.includes(root)))("the api root's integrity > %s", (root) => {
		describe.each(selected)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
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
					// A function root takes it too, on the root, as a function does.
					else expect(atRoot).toEqual({ same: true, inherited: 5 });
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
					await api.slothlet.api.add("zz.more", join(FIXTURE, root, "data.mjs"), { id: "more" });
					expect(api.zz.more.a).toBe(1);
					// A member the root did not hold is not added, as on a frozen node.
					await expect(api.slothlet.api.add("extra", join(FIXTURE, root, "data.mjs"), { id: "extra" })).rejects.toMatchObject({
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

				it("sets the root's prototype, as on an object or a function", async () => {
					api = await build(root, { mode, runtime });
					const prototype = { inherited: 5 };
					Object.setPrototypeOf(api, prototype);
					expect(Object.getPrototypeOf(api)).toBe(prototype);
					expect(api.inherited).toBe(5);
					expect("inherited" in api).toBe(true);
					expect(Object.keys(api)).not.toContain("inherited");
				});

				it.runIf(root !== "objroot")("a function root takes, reports and inherits from a prototype as a plain function does", async () => {
					api = await build(root, { mode, runtime });
					const plain = root === "fnroot" ? function root() {} : async function root() {};
					expect(observePrototype(api)).toEqual(observePrototype(plain));
					// The root still calls, and its file's function kept its prototype: the same folder's node at `zz` reports it.
					expect(typeof api).toBe("function");
					expect(await api()).toBe("root");
					expect(Object.getPrototypeOf(api.zz)).toBe(Object.getPrototypeOf(plain));
				});

				it.runIf(root !== "objroot")(
					"a function root closed with a prototype it was given reports it, and then takes no other",
					async () => {
						for (const how of ["seal", "freeze", "preventExtensions"]) {
							api = await build(root, { mode, runtime });
							const plain = root === "fnroot" ? function root() {} : async function root() {};
							expect(observeClosedPrototype(api, how), how).toEqual(observeClosedPrototype(plain, how));
							await api.shutdown();
						}
						api = null;
					}
				);

				it.runIf(root !== "objroot")("a function root has its function's prototype again once a reload gives it its value", async () => {
					api = await build(root, { mode, runtime });
					const first = Object.getPrototypeOf(api);
					Object.setPrototypeOf(api, { inherited: 5 });
					expect(api.inherited).toBe(5);
					await api.slothlet.reload();
					expect(Object.getPrototypeOf(api)).toBe(first);
					expect(api.inherited).toBeUndefined();
					expect(await api()).toBe("root");
				});

				describe("a prototype given to the root, as a module is handed it", () => {
					/** Rules letting one leaf of the writer read one inherited member, and its lister list it. */
					const rules = [
						{ caller: "w.ops.protoRead", target: "inherited", effect: "allow" },
						{ caller: "w.ops.protoListed", target: "inherited", effect: "allow" },
						{ caller: "w.ops.protoKeys", target: "inherited", effect: "allow" },
						{ caller: "w.ops.protoRead", target: "deepRuled", effect: "allow" },
						// The writer reaches the root through `self.slothlet.diag.api()` too.
						{ caller: "w.**", target: "slothlet.diag", effect: "allow" },
						{ caller: "w.**", target: "slothlet.diag.**", effect: "allow" }
					];
					const NAMES_ASKED = ["inherited", "unruled", "deepRuled", "deepUnruled"];

					it("reads and lists each member as the root reads it, and leaves the rest out", async () => {
						api = await build(root, { mode, runtime, permissions: { policy: "deny", caller: { attribution }, rules } });
						const prototype = Object.assign(Object.create({ deepRuled: 1, deepUnruled: 2 }), { inherited: 5, unruled: 6 });
						Object.setPrototypeOf(api, prototype);
						// The host is handed the object itself, and reads everything.
						expect(Object.getPrototypeOf(api)).toBe(prototype);
						expect(api.__proto__).toBe(prototype);
						expect([api.inherited, api.unruled, api.deepUnruled]).toEqual([5, 6, 2]);
						for (const via of ["given", "api"]) {
							// A module reads a member from the prototype under the rule it reads it through the root under.
							expect(api.w.ops.protoRead(via, "inherited", api, 0)).toBe(5);
							expect(api.w.ops.protoRead(via, "inherited", api, 1)).toBe(5);
							expect(api.w.ops.protoRead(via, "deepRuled", api, 2)).toBe(1);
							const throughRoot = api.w.ops.protoRead(via, "unruled", api, 0);
							expect(throughRoot.code).toBe("PERMISSION_DENIED");
							expect(api.w.ops.protoRead(via, "unruled", api, 1)).toEqual(throughRoot);
							expect(api.w.ops.protoRead(via, "deepUnruled", api, 2)).toEqual(api.w.ops.protoRead(via, "deepUnruled", api, 0));
							expect(api.w.ops.protoRead(via, "deepUnruled", api, 2).code).toBe("PERMISSION_DENIED");
							expect(api.w.ops.protoPeek(via, "inherited", api, 1).code).toBe("PERMISSION_DENIED");
							// Its listings leave out what the module may not read; `in` answers as for a member of the root's own.
							expect(api.w.ops.protoListed(via, api, prototype, NAMES_ASKED)).toEqual({
								same: false,
								stable: true,
								keys: ["inherited"],
								ownKeys: ["inherited"],
								forIn: ["inherited"],
								spread: ["inherited"],
								json: '{"inherited":5}',
								has: [true, true, true, true],
								described: [true, false, false, false]
							});
							// A write through it is a write at the root, which the writer does not own.
							expect(api.w.ops.protoWrite(via, api)).not.toBe("done");
						}
						expect(Object.hasOwn(prototype, "written")).toBe(false);
					});

					it("an inherited object member the module may read nothing beneath is left out of its listings", async () => {
						const objectRules = [...rules, { caller: "w.ops.protoObjects", target: "partly.a", effect: "allow" }];
						api = await build(root, { mode, runtime, permissions: { policy: "deny", caller: { attribution }, rules: objectRules } });
						Object.setPrototypeOf(api, { nothing: { a: 1 }, partly: { a: 1, b: 2 } });
						for (const via of ["given", "api"]) {
							// Plain JS lists both; the module may read nothing beneath `nothing`, which is left out as a node leaves out
							// the same member of its own, and `partly` is listed holding the one leaf the module may read.
							expect(api.w.ops.protoObjects(via, api), via).toEqual({
								keys: ["partly"],
								ownKeys: ["partly"],
								forIn: ["partly"],
								spread: ["partly"],
								json: '{"partly":{"a":1}}',
								has: [true, true, true],
								partly: [1, ["a"]]
							});
						}
					});

					it("a closed root holds the checked prototype for every holder", async () => {
						api = await build(root, { mode, runtime, permissions: { policy: "deny", caller: { attribution }, rules } });
						const prototype = { inherited: 5, unruled: 6 };
						Object.setPrototypeOf(api, prototype);
						Object.freeze(api);
						expect(Object.getPrototypeOf(api)).not.toBe(prototype);
						expect(Object.getPrototypeOf(api)).toBe(Object.getPrototypeOf(api));
						expect([Object.getPrototypeOf(api).inherited, Object.getPrototypeOf(api).unruled, api.unruled]).toEqual([5, 6, 6]);
						expect(Reflect.setPrototypeOf(api, Object.getPrototypeOf(api))).toBe(true);
						expect(Reflect.setPrototypeOf(api, prototype)).toBe(false);
						expect(api.w.ops.protoRead("given", "inherited", api, 1)).toBe(5);
						expect(api.w.ops.protoRead("given", "unruled", api, 1).code).toBe("PERMISSION_DENIED");
						expect(api.w.ops.protoKeys("given", api)).toEqual(["inherited"]);
					});
				});

				it.runIf(attribution === "precise")(
					"a module is handed the root's prototype itself with the permission system off or disabled",
					async () => {
						for (const permissions of [undefined, { mode: "disabled" }]) {
							api = await build(root, { mode, runtime, permissions });
							const prototype = { inherited: 5 };
							Object.setPrototypeOf(api, prototype);
							const shown = api.w.ops.protoListed("given", api, prototype, ["inherited"]);
							expect([shown.same, shown.stable, shown.keys]).toEqual([true, true, ["inherited"]]);
							expect(api.w.ops.protoRead("given", "inherited", api, 1)).toBe(5);
							await api.shutdown();
						}
						api = null;
					}
				);

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
}
