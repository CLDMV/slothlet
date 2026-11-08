/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-leaf-body.test.vitest.mjs
 *	@Date: 2026-11-07T21:44:36-08:00 (1794116676)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:32:13-08:00 (1794169933)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #717 — a host leaf's own body runs as the leaf, whatever its caller hands it.
 *
 * @description
 * docs/PERMISSIONS.md, "Code a caller hands to a leaf runs as the caller": a leaf the host added as an object is its own
 * entity at its path. While it runs, everything inside its call runs as the leaf (its body, the helpers of its file),
 * whatever its caller hands it, except the code the caller handed in (a callback, a getter, a `toString`, a Proxy trap)
 * and evaluated code, which run as the caller, with the leaf as their ceiling.
 *
 * The host's leaves here are added as an object, the shape of rummage's `host.records.*` and `host.callback.*`: once
 * from a file of the host's (`host/access.mjs`, mounted at `host.access`) and once written in this file (`host.inline`).
 * Their bodies read `vault.get`, which only `host.**` may call, call a helper of their own file that does, ask
 * `permissions.global.checkAccess`, and run what they were handed. `project.hand` hands them a value; `project.**` may
 * call `host.**` and `vault.open` but not `vault.get`.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-leaf-body
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { makeAccess } from "../../../../api_tests/api_test_leaf_body_mutable_arg/host/access.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_leaf_body_mutable_arg");
const HOST_FILE = path.join(FIXTURE, "host", "access.mjs");
const THIS_FILE = fileURLToPath(import.meta.url);

const RULES = [
	{ caller: "project.**", target: "host.**", effect: "allow" },
	{ caller: "project.**", target: "vault.open", effect: "allow" },
	{ caller: "host.**", target: "vault.get", effect: "allow" },
	{ caller: "host.**", target: "slothlet.permissions.global.**", effect: "allow" },
	{ caller: "**", target: "vault.whoami", effect: "allow" },
	{ caller: "other.**", target: "project.own", effect: "allow" }
];

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * Run an access, reporting what it gave or the code and caller it was refused with (this file's helper, as
 * `attempt` is `host/access.mjs`'s).
 * @param {() => unknown} access - The access.
 * @returns {unknown} Its value, or `"<code>:<caller>"`.
 */
function inlineAttempt(access) {
	try {
		return access();
	} catch (error) {
		return `${error?.code}:${error?.context?.caller ?? null}`;
	}
}

/**
 * The host's leaves written in this file: the same bodies as `host/access.mjs`'s, with this file's helper.
 * @param {() => object} getApi - The host's api.
 * @returns {Record<string, Function>} The leaves.
 */
function inlineLeaves(getApi) {
	const readVault = () => inlineAttempt(() => getApi().vault.get());
	return {
		register(_) {
			return inlineAttempt(() => getApi().vault.get());
		},
		viaHelper(_) {
			return readVault();
		},
		check(_) {
			return inlineAttempt(() => getApi().slothlet.permissions.global.checkAccess("project.hand", "vault.get"));
		},
		who(_) {
			return inlineAttempt(() => getApi().vault.whoami());
		},
		run(callback) {
			const own = readVault();
			return { own, handed: inlineAttempt(() => callback()), after: readVault() };
		},
		read(arg) {
			const own = readVault();
			return { own, handed: inlineAttempt(() => arg.id) };
		},
		convert(arg) {
			const own = readVault();
			return { own, handed: inlineAttempt(() => String(arg)) };
		},
		async later(_) {
			const before = readVault();
			await null;
			return { before, after: readVault() };
		},
		async awaitFirst(_) {
			await Promise.resolve();
			return readVault();
		},
		async timerFirst(_) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return readVault();
		},
		async awaitCheck(_) {
			await Promise.resolve();
			return inlineAttempt(() => getApi().slothlet.permissions.global.checkAccess("project.hand", "vault.get"));
		},
		async timerWho(_) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return inlineAttempt(() => getApi().vault.whoami());
		},
		async awaitRun(callback) {
			await Promise.resolve();
			const own = readVault();
			return { own, handed: inlineAttempt(() => callback()) };
		},
		deferFirst(callback) {
			// No identity read before the reaction: the handed code runs as a reaction of its own.
			return Promise.resolve()
				.then(callback)
				.then(
					(handed) => ({ handed }),
					(error) => ({ handed: `${error?.code}:${error?.context?.caller ?? null}` })
				);
		},
		defer(callback) {
			const own = readVault();
			// Run as a reaction of its own, with none of this file's frames on the stack below it.
			return Promise.resolve()
				.then(callback)
				.then(
					(handed) => ({ own, handed }),
					(error) => ({ own, handed: `${error?.code}:${error?.context?.caller ?? null}` })
				);
		}
	};
}

/** Each mount of the host's leaves: where they were built, and the file planted code names to look like them. */
const MOUNTS = [
	{ mount: "access", label: "an object from a host file", file: HOST_FILE },
	{ mount: "inline", label: "an object written in the host's own file", file: THIS_FILE }
];

const DENIED = "PERMISSION_DENIED:project.hand";

describe.each(CONFIGS)("Permissions > a host leaf's own body runs as the leaf (#717) — $mode/$runtime", ({ mode, runtime }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({
			base: path.join(FIXTURE, "api"),
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "deny", rules: RULES }
		});
		await api.slothlet.api.add(
			["host", "access"],
			makeAccess(() => api),
			{ moduleID: "host-access" }
		);
		await api.slothlet.api.add(
			["host", "inline"],
			inlineLeaves(() => api),
			{ moduleID: "host-inline" }
		);
	});

	afterAll(async () => {
		await api?.slothlet.shutdown();
	});

	describe.each(MOUNTS)("$label", ({ mount, file }) => {
		it.each(["mutable", "frozen", "nested"])("reads what the leaf may read, handed %s data", async (kind) => {
			expect(await api.project.hand(mount, "register", kind)).toBe("secret");
		});

		it.each(["mutable", "frozen"])("runs a helper of its own file as the leaf, handed %s data", async (kind) => {
			expect(await api.project.hand(mount, "viaHelper", kind)).toBe("secret");
		});

		it.each(["mutable", "frozen"])("asks the permission system as the leaf, handed %s data", async (kind) => {
			expect(await api.project.hand(mount, "check", kind)).toBe(false);
		});

		it.each(["mutable", "frozen"])("is the caller of what its body calls, handed %s data", async (kind) => {
			expect(await api.project.hand(mount, "who", kind)).toBe(`host.${mount}.who`);
		});

		it("keeps the leaf's identity after an await", async () => {
			expect(await api.project.hand(mount, "later", "mutable")).toEqual({ before: "secret", after: "secret" });
		});

		it("runs a callback it was handed as the caller, and its own code around it as the leaf", async () => {
			expect(await api.project.hand(mount, "run", "callback")).toEqual({ own: "secret", handed: DENIED, after: "secret" });
		});

		it("reports the caller to what a handed callback calls", async () => {
			expect(await api.project.hand(mount, "run", "callbackWho")).toEqual({ own: "secret", handed: "project.hand", after: "secret" });
		});

		it("holds a handed callback to the leaf as its ceiling", async () => {
			const result = await api.project.hand(mount, "run", "callbackOpen");
			expect(result.own).toBe("secret");
			expect(result.after).toBe("secret");
			expect(result.handed).toMatch(/^PERMISSION_DENIED:/);
		});

		it.each([
			["read", "getter"],
			["read", "proxy"],
			["convert", "toString"]
		])("runs a handed value's code as the caller (%s, %s)", async (leaf, kind) => {
			expect(await api.project.hand(mount, leaf, kind)).toEqual({ own: "secret", handed: DENIED });
		});

		it.each(["vm", "vmScript", "sourceURL"])("refuses code compiled to look like the leaf's (%s)", async (kind) => {
			expect(await api.project.hand(mount, "run", kind, file)).toEqual({ own: "secret", handed: DENIED, after: "secret" });
		});

		it("runs a handed callback as the caller when it runs as a reaction with none of the leaf's frames below it", async () => {
			expect(await api.project.hand(mount, "defer", "callback")).toEqual({ own: "secret", handed: DENIED });
		});

		it.each(["vm", "vmScript", "sourceURL"])(
			"refuses code compiled to look like the leaf's when it runs as a reaction with none of the leaf's frames below it (%s)",
			async (kind) => {
				const result = await api.project.hand(mount, "defer", kind, file);
				expect(result.own).toBe("secret");
				// Never the leaf's: the call that made the leaf's in the async runtime; the live runtime refuses it outright.
				if (runtime === "async") expect(result.handed).toBe(DENIED);
				else expect(result.handed).toMatch(/^[A-Z_]+:/);
			}
		);

		// A leaf with no file whose first identity read comes after an await, in a call where its script was never
		// learned: each of these leaves is called here first, so nothing ran inside it before the await.
		it.each([
			["awaitFirst", "secret"],
			["timerFirst", "secret"],
			["awaitCheck", false]
		])("runs its own body as the leaf when its first identity read comes after an await (%s)", async (leaf, expected) => {
			expect(await api.project.hand(mount, leaf, "mutable")).toBe(expected);
		});

		it("is the caller of what its body calls when its first call comes after a timer", async () => {
			expect(await api.project.hand(mount, "timerWho", "mutable")).toBe(`host.${mount}.timerWho`);
		});

		it.each(["callback", "vm", "vmScript", "sourceURL"])(
			"runs its own body as the leaf after an await and what it was handed as the caller (%s)",
			async (kind) => {
				expect(await api.project.hand(mount, "awaitRun", kind, file)).toEqual({ own: "secret", handed: DENIED });
			}
		);

		it.each(["vm", "vmScript", "sourceURL"])(
			"refuses code compiled to look like the leaf's in a reaction, before the leaf read any identity (%s)",
			async (kind) => {
				const result = await api.project.hand(mount, "deferFirst", kind, file);
				if (runtime === "async") expect(result.handed).toBe(DENIED);
				else expect(result.handed).toMatch(/^[A-Z_]+:/);
			}
		);
	});

	it("still runs a module's own leaf body as that module", async () => {
		expect(await api.other.callOwn()).toEqual({ who: "project.own", open: "open", id: "x" });
	});
});
