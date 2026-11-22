/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/handed-builtin-writes.test.vitest.mjs
 *	@Date: 2026-11-21T13:05:28-08:00 (1795295128)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T15:11:04-08:00 (1795302664)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A built-in one module hands another to run, bound to a write or handed with its target, writes nothing
 * the handing module could not write itself.
 *
 * @description
 * The guest has no write rule. It binds `Object.assign`, `Reflect.set`, `Object.defineProperty` or
 * `Reflect.deleteProperty` to a write of another module's class prototype (read through the class, or through an
 * instance) or of its api node, or hands `Reflect.set` or Node's `util._extend` unbound with the target as an argument,
 * to a module that runs the callback it is handed: the module that owns the target, the base module (which owns the whole
 * tree), or a peer granted `**:full`. Each write ends as the guest's own direct write of it does, refused with the same
 * code, and nothing lands; a member the guest may not read is not written either. A write the guest may make itself,
 * handed to a module that may make it too, lands; reads and built-ins that only compute are unaffected. A member
 * private to a module is refused to every other module through an instance as through the prototype. With the permission
 * system off or disabled every write lands and every member is read, as in plain JavaScript. Checked in eager and lazy
 * mode, async and live runtime, attribution `"precise"` and `"fast"`.
 * @module tests/vitests/suites/permissions/handed-builtin-writes
 */

import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_handed_builtin_writes");

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) CONFIGS.push({ mode, runtime });

/** Each write the guest makes, by the name its fixture knows it under. */
const WRITES = [
	"protoBound",
	"instanceProtoBound",
	"protoUnbound",
	"protoNodeHelper",
	"methodBound",
	"nodeBound",
	"nodeUnbound",
	"fnBound",
	"fnDefineBound",
	"deleteBound",
	"secretBound",
	"secretUnbound"
];

/** Each route the guest reads a member private to another module through one of its instances by. */
const PRIVATE_READS = ["newData", "madeData", "madeReflect", "newMethod", "madeMethod", "proto"];

/** The routes the peer reads them by. */
const PEER_PRIVATE_READS = ["newData", "madeData", "madeMethod"];

/** [module written, module that runs the handed built-in]. */
const PAIRS = [
	["vault", "vault"],
	["owner", "owner"],
	["owner", "vault"],
	["vault", "owner"],
	["owner", "peer"],
	["vault", "peer"]
];

/** The peer may write everywhere; the guest may read neither module's `secret`. */
const RULES = [
	{ caller: "peer.**", target: "**:full", effect: "allow" },
	{ caller: "guest.**", target: "vault.secret:read", effect: "deny" },
	{ caller: "guest.**", target: "owner.secret:read", effect: "deny" }
];

/**
 * Build the instance: the base module, and the owner, the guest and the peer mounted as modules of their own.
 * @param {object} config - Mode and runtime.
 * @param {object} permissions - The permission config.
 * @returns {Promise<object>} The api, every module loaded.
 */
async function mount(config, permissions) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...config, permissions });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { id: "owner" });
	await api.slothlet.api.add("guest", join(FIXTURE, "guest"), { id: "guest" });
	await api.slothlet.api.add("peer", join(FIXTURE, "peer"), { id: "peer" });
	await api.vault.protoState();
	await api.owner.protoState();
	await api.guest.readMine();
	await api.peer.runCb(() => 1);
	return api;
}

/**
 * What the host reads of a module's members and its prototype.
 * @param {object} api - The api.
 * @param {string} path - The module.
 * @returns {Promise<object>} The snapshot.
 */
async function snapshot(api, path) {
	const node = api[path];
	return {
		open: "open" in node ? node.open : "<deleted>",
		secret: node.secret,
		fn: await node.fn(),
		proto: await node.protoState()
	};
}

describe("a built-in handed to another module to run writes nothing the handing module could not", () => {
	for (const config of CONFIGS) {
		for (const attribution of ["precise", "fast"]) {
			const label = `${config.mode}/${config.runtime}/${attribution}`;
			for (const [ownerPath, runnerPath] of PAIRS) {
				it(`${label}: written ${ownerPath}, run by ${runnerPath}: refused as the guest's own write, nothing lands`, async () => {
					const api = await mount(config, { mode: "on", policy: "allow", caller: { attribution }, rules: RULES });
					try {
						const before = await snapshot(api, ownerPath);
						for (const name of WRITES) {
							// Under "fast" an instance the base module hands out reaches the guest with its prototype as is, so the
							// guest's own write through it lands; that route is no handed built-in's and is left out here.
							if (name === "instanceProtoBound" && ownerPath === "vault" && attribution === "fast") continue;
							const direct = await api.guest.direct(name, ownerPath);
							expect(direct, `${name}: the guest's own write`).toMatch(/^threw (LOOSE_SET_NOT_OWNED|PERMISSION_DENIED)$/);
							expect(await api.guest.handed(name, ownerPath, runnerPath), name).toBe(direct);
							expect(await snapshot(api, ownerPath), name).toEqual(before);
						}
						expect(await api.guest.handedDeferred(ownerPath, runnerPath), "called back later").toBe("threw LOOSE_SET_NOT_OWNED");
						expect(await snapshot(api, ownerPath), "called back later").toEqual(before);
						expect(await api.guest.handedDeferredDetached(ownerPath, runnerPath)).toBe("scheduled");
						await new Promise((done) => setTimeout(done, 20));
						expect(await api.guest.deferredResult(), "called back after the call ended").toBe("threw LOOSE_SET_NOT_OWNED");
						expect(await snapshot(api, ownerPath), "called back after the call ended").toEqual(before);
					} finally {
						await api.slothlet.shutdown();
					}
				});
			}
			it(`${label}: the owner running a handed built-in on its own prototype writes for the guest`, async () => {
				const api = await mount(config, { mode: "on", policy: "allow", caller: { attribution }, rules: RULES });
				try {
					const before = await snapshot(api, "owner");
					expect(await api.guest.handedOnOwnProto("owner")).toBe("threw LOOSE_SET_NOT_OWNED");
					expect(await snapshot(api, "owner")).toEqual(before);
				} finally {
					await api.slothlet.shutdown();
				}
			});
			it(`${label}: a write both may make lands; reads and pure built-ins are unaffected`, async () => {
				const api = await mount(config, { mode: "on", policy: "allow", caller: { attribution }, rules: RULES });
				try {
					expect(await api.guest.handedOwnWrite("peer")).toBe("done");
					expect(await api.guest.readMine()).toBe("W");
					for (const [ownerPath, runnerPath] of PAIRS) expect(await api.guest.handedRead(ownerPath, runnerPath)).toBe("open");
					for (const runnerPath of ["vault", "owner", "peer"]) expect(await api.guest.handedPure(runnerPath)).toBe(5);
					expect(await api.guest.handedIsReflectSet()).toBe(true);
					for (const ownerPath of ["vault", "owner"]) {
						expect(await api.guest.readPublic(ownerPath), `public members of ${ownerPath}'s instance`).toBe("method,method");
					}
				} finally {
					await api.slothlet.shutdown();
				}
			});
		}
		for (const mode of ["off", "disabled"]) {
			it(`${config.mode}/${config.runtime}: permissions ${mode}: every handed write lands, as in plain JavaScript`, async () => {
				for (const [ownerPath, runnerPath] of PAIRS) {
					const api = await mount(config, { mode, rules: RULES });
					try {
						for (const name of WRITES) {
							const before = await snapshot(api, ownerPath);
							expect(await api.guest.handed(name, ownerPath, runnerPath), `${name} ${ownerPath}/${runnerPath}`).toBe("done");
							expect(await snapshot(api, ownerPath), `${name} ${ownerPath}/${runnerPath}`).not.toEqual(before);
						}
						expect(await api.guest.handedDeferred(ownerPath, runnerPath)).toBe("done");
						expect((await api[ownerPath].protoState()).protoKeys).toContain("planted6");
						expect(await api.guest.handedDeferredDetached(ownerPath, runnerPath)).toBe("scheduled");
						await new Promise((done) => setTimeout(done, 20));
						expect(await api.guest.deferredResult()).toBe("done");
						expect((await api[ownerPath].protoState()).protoKeys).toContain("planted7");
						expect(await api.guest.handedOnOwnProto("owner")).toBe("done");
						expect((await api.owner.protoState()).protoKeys).toContain("planted5");
					} finally {
						await api.slothlet.shutdown();
					}
				}
			});
		}
	}
});

describe("a member private to a module is read through its instances only by that module", () => {
	for (const config of CONFIGS) {
		for (const attribution of ["precise", "fast"]) {
			it(`${config.mode}/${config.runtime}/${attribution}: refused to another module as through the class's prototype`, async () => {
				const api = await mount(config, { mode: "on", policy: "allow", caller: { attribution }, rules: RULES });
				try {
					for (const ownerPath of ["vault", "owner"]) {
						for (const how of PRIVATE_READS)
							expect(await api.guest.readPrivate(how, ownerPath), `guest ${how} ${ownerPath}`).toBe("threw PERMISSION_DENIED");
						for (const how of PEER_PRIVATE_READS)
							expect(await api.peer.readPrivate(how, ownerPath), `peer ${how} ${ownerPath}`).toBe("threw PERMISSION_DENIED");
						expect(await api.guest.readPublic(ownerPath)).toBe("method,method");
					}
				} finally {
					await api.slothlet.shutdown();
				}
			});
		}
		for (const mode of ["off", "disabled"]) {
			it(`${config.mode}/${config.runtime}: permissions ${mode}: read by every module, as in plain JavaScript`, async () => {
				const api = await mount(config, { mode, rules: RULES });
				try {
					for (const ownerPath of ["vault", "owner"]) {
						for (const how of PRIVATE_READS) {
							const expected = how === "newMethod" || how === "madeMethod" ? "priv" : "PDATA";
							expect(await api.guest.readPrivate(how, ownerPath), `guest ${how} ${ownerPath}`).toBe(expected);
						}
						expect(await api.peer.readPrivate("madeData", ownerPath)).toBe("PDATA");
						expect(await api.guest.readPublic(ownerPath)).toBe("method,method");
					}
				} finally {
					await api.slothlet.shutdown();
				}
			});
		}
	}
});
