/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/shutdown-node-reads.test.vitest.mjs
 *	@Date: 2026-11-21T21:11:39-08:00 (1795324299)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T22:28:20-08:00 (1795328900)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Api nodes a module keeps in variables read nothing once its instance has shut down.
 *
 * @description
 * A guest module reads the vault through `self` while the instance runs and keeps what it read: the vault node, its
 * `box` member and its `shown` function. The guest has deny rules on `vault.secret`, `vault.box.inner` and
 * `vault.hidden` when permissions are on. Once the instance has shut down, every read the module's code makes through
 * what it kept is refused, the members it was allowed as well as the ones it was denied: a member read, a nested path, a
 * call, listing, `in` and describing a member. That holds from a function the module handed out and from a timer it
 * left behind, under both runtimes, eager and lazy, permissions on and off. The host reading its own `api` after the
 * shutdown is not affected.
 *
 * A second guest (`api_test_shutdown_kept_handles`) keeps the framework's namespace (`self.slothlet`), a class node and
 * the class's prototype. Once the instance has shut down, every use of them from the module's code is refused: reading,
 * listing, describing and calling through the namespace, adding a folder and reloading through it, every access through
 * the prototype's handle (the one object every reader is handed), and constructing through the kept class. With
 * permissions off the module holds the prototype itself, as plain JS hands it, and it reads as a plain object reads. The
 * host's own uses, and its reads through a prototype a module handed it, are as before. A reload after the shutdown
 * that fails leaves the instance shut down, and the uses refused.
 */

import path from "node:path";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_shutdown_node_reads");

const COMBOS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const permissions of ["on", "off"])
			COMBOS.push({ name: `${mode}/${runtime}/permissions ${permissions}`, mode, runtime, permissions });

/** The guest's deny rules. */
const RULES = [
	{ caller: "guest.**", target: "vault.secret", effect: "deny" },
	{ caller: "guest.**", target: "vault.box.inner", effect: "deny" },
	{ caller: "guest.**", target: "vault.hidden", effect: "deny" }
];

/**
 * Wait until `test` holds, up to `ms`.
 * @param {Function} test - The condition.
 * @param {number} [ms=2000] - The limit.
 * @returns {Promise<boolean>} Whether it held.
 */
async function until(test, ms = 2000) {
	const end = Date.now() + ms;
	while (!test()) {
		if (Date.now() > end) return false;
		await new Promise((resolve) => {
			setTimeout(resolve, 1);
		});
	}
	return true;
}

/**
 * What the host's own reads of its api give.
 * @param {object} api - The api.
 * @returns {Object<string, string>} The outcomes by access.
 */
function hostReads(api) {
	const one = (fn) => {
		try {
			return String(fn());
		} catch (error) {
			return `!${error?.code ?? error?.name ?? String(error)}`;
		}
	};
	return {
		readSecret: one(() => api.vault.secret),
		readOpen: one(() => api.vault.open),
		readBoxInner: one(() => api.vault.box.inner),
		listKeys: one(() => Object.keys(api.vault).sort().join(",")),
		hasOpen: one(() => "open" in api.vault),
		callShown: one(() => api.vault.shown()),
		callHidden: one(() => api.vault.hidden())
	};
}

describe.each(COMBOS)("Permissions > api nodes a module kept read nothing once its instance has shut down > $name", (combo) => {
	let api;

	afterEach(async () => {
		const gate = globalThis.__slothletShutdownNodeReadsGate;
		if (gate) gate.stop = true;
		await api?.slothlet.shutdown().catch(() => {});
		api = undefined;
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
		delete globalThis.__slothletShutdownNodeReadsGate;
		delete globalThis.__slothletShutdownNodeReads;
	});

	/**
	 * Load the instance with the guest mounted.
	 * @returns {Promise<object>} The api.
	 */
	async function load() {
		globalThis.__slothletShutdownNodeReadsGate = { go: false, stop: false };
		api = await slothlet({
			base: path.join(ROOT, "base"),
			mode: combo.mode,
			runtime: combo.runtime,
			silent: true,
			permissions: combo.permissions === "on" ? { mode: "on", policy: "allow", rules: RULES } : { mode: "off" }
		});
		await api.slothlet.api.add("guest", path.join(ROOT, "guest"), { id: "guest" });
		return api;
	}

	it("while the instance runs, the module reads through what it kept as the rules allow", async () => {
		await load();
		const now = await api.guest.keep.hold();
		const denied = combo.permissions === "on";
		expect(now.readSecret).toBe(denied ? "!PERMISSION_DENIED" : "SECRET");
		expect(now.readKeptBoxInner).toBe(denied ? "!PERMISSION_DENIED" : "INNER");
		expect(now.readOpen).toBe("open");
		expect(now.readBoxOuter).toBe("OUTER");
		expect(now.readKeptBoxOuter).toBe("OUTER");
		expect(now.callShown).toBe("SHOWN");
		expect(now.callShownOnNode).toBe("SHOWN");
		expect(now.listKeys.split(",")).toContain("open");
		expect(now.hasOpen).toBe("true");
		expect(now.describeOpen).toBe("open");
		expect(now.selfOpen).toBe("open");
	});

	it("after shutdown, every read through a kept node is refused, from a function the module handed out and from a timer it left", async () => {
		await load();
		await api.guest.keep.hold();
		await api.slothlet.shutdown();
		api = undefined;

		const record = globalThis.__slothletShutdownNodeReads;
		const handedOut = record.attempt();
		const gate = globalThis.__slothletShutdownNodeReadsGate;
		gate.go = true;
		expect(await until(() => record.timer.length > 0)).toBe(true);
		gate.stop = true;
		for (const [source, outcome] of [
			["handed-out function", handedOut],
			["timer", record.timer[0]]
		]) {
			// Every access through what the module kept is refused as a read of `self` itself is once the instance has gone.
			for (const [access, value] of Object.entries(outcome)) expect(value, `${source} ${access}`).toBe("!CONTEXT_NOT_ACTIVE_SELF");
		}
	});

	it("after shutdown, the host reads its own api as it did before this change", async () => {
		await load();
		await api.guest.keep.hold();
		const host = api;
		await api.slothlet.shutdown();
		api = undefined;
		// The host's own api: data members still read, calls report the instance's context gone, as before.
		expect(hostReads(host)).toEqual({
			readSecret: "SECRET",
			readOpen: "open",
			readBoxInner: "INNER",
			listKeys: "box,hidden,open,secret,shown",
			hasOpen: "true",
			callShown: "!CONTEXT_NOT_FOUND",
			callHidden: "!CONTEXT_NOT_FOUND"
		});
	});
});

const KEPT_ROOT = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_shutdown_kept_handles");

/**
 * What one attempt gave: its value as a string, or `!` and the code of what it threw.
 * @param {Function} fn - The attempt.
 * @returns {string} The outcome.
 */
function outcome(fn) {
	try {
		const value = fn();
		if (value !== null && typeof value === "object" && typeof value.then === "function") {
			value.then(
				() => {},
				() => {}
			);
			return "promise";
		}
		return String(value);
	} catch (error) {
		return `!${error?.code ?? error?.name ?? String(error)}`;
	}
}

/** Every use the guest makes of what it kept (see the fixture's `reads()` and `calls()`). */
const KEPT_USES = [
	"nsContextGet",
	"nsMetadata",
	"nsApiAdd",
	"nsReload",
	"nsListKeys",
	"nsHasApi",
	"nsDescribeApi",
	"protoRead",
	"protoCall",
	"protoListKeys",
	"protoHas",
	"protoDescribe",
	"protoPrototype",
	"protoConstructor",
	"constructKept",
	"constructFromProto",
	"nsContextGetCall",
	"nsApiAddCall",
	"nsReloadCall"
];

/** The guest's uses of the class's prototype as plain JS answers them on the object itself. */
const HELD_PROTOTYPE_USES = {
	protoRead: "function",
	protoCall: "y",
	protoListKeys: "constructor,read",
	protoHas: "true",
	protoDescribe: "function",
	protoPrototype: "true",
	protoConstructor: "function",
	constructFromProto: "w"
};

describe.each(COMBOS)(
	"Permissions > the framework namespace, a class node and its prototype a module kept use nothing once its instance has shut down > $name",
	(combo) => {
		let api;

		afterEach(async () => {
			const gate = globalThis.__slothletShutdownKeptHandlesGate;
			if (gate) gate.stop = true;
			await api?.slothlet.shutdown().catch(() => {});
			api = undefined;
			await new Promise((resolve) => {
				setTimeout(resolve, 5);
			});
			delete globalThis.__slothletShutdownKeptHandlesGate;
			delete globalThis.__slothletShutdownKeptHandles;
		});

		/**
		 * Load the instance with the guest mounted, and have the guest keep what it reads.
		 * @returns {Promise<Object<string, string>>} The guest's reads through what it kept, from its own call.
		 */
		async function loadAndHold() {
			globalThis.__slothletShutdownKeptHandlesGate = { go: false, stop: false };
			api = await slothlet({
				base: path.join(KEPT_ROOT, "base"),
				mode: combo.mode,
				runtime: combo.runtime,
				silent: true,
				permissions: combo.permissions === "on" ? { mode: "on", policy: "allow" } : { mode: "off" }
			});
			await api.slothlet.api.add("guest", path.join(KEPT_ROOT, "guest"), { id: "guest" });
			return api.guest.keep.hold(path.join(KEPT_ROOT, "extra"));
		}

		it("while the instance runs, the module uses what it kept as plain JS has it", async () => {
			const now = await loadAndHold();
			expect(now).toEqual({
				nsContextGet: "function",
				nsMetadata: "object",
				nsApiAdd: "function",
				// Reading `reload` is refused a module by the built-in rules while permissions are on.
				nsReload: combo.permissions === "on" ? "!PERMISSION_DENIED" : "function",
				nsListKeys: "true",
				nsHasApi: "true",
				nsDescribeApi: "object",
				protoRead: "function",
				protoCall: "y",
				protoListKeys: "constructor,read",
				protoHas: "true",
				protoDescribe: "function",
				protoPrototype: "true",
				protoConstructor: "function",
				constructKept: "z",
				constructFromProto: "w"
			});
		});

		it("after shutdown, every use of what it kept is refused, from a function the module handed out and from a timer it left", async () => {
			await loadAndHold();
			await api.slothlet.shutdown();
			api = undefined;

			const record = globalThis.__slothletShutdownKeptHandles;
			const handedOut = { ...record.reads(), ...record.calls() };
			const gate = globalThis.__slothletShutdownKeptHandlesGate;
			gate.go = true;
			expect(await until(() => record.timer.length > 0)).toBe(true);
			gate.stop = true;
			for (const [source, outcomes] of [
				["handed-out function", handedOut],
				["timer", record.timer[0]]
			]) {
				// Every use is refused as a read of `self` itself is once the instance has gone. With permissions off the module
				// holds the class's prototype itself, as plain JS hands it (no handle stands between them), and reads it as a plain
				// object reads.
				expect(outcomes, source).toEqual({
					...Object.fromEntries(KEPT_USES.map((use) => [use, "!CONTEXT_NOT_ACTIVE_SELF"])),
					...(combo.permissions === "off" ? HELD_PROTOTYPE_USES : {})
				});
			}
		});

		it("after shutdown, the host uses its own api, and a prototype a module handed it, as it did before this change", async () => {
			await loadAndHold();
			const host = api;
			const handed = globalThis.__slothletShutdownKeptHandles.proto;
			await api.slothlet.shutdown();
			api = undefined;
			expect({
				nsContextGet: outcome(() => typeof host.slothlet.context.get),
				nsMetadata: outcome(() => typeof host.slothlet.metadata),
				nsApiAdd: outcome(() => typeof host.slothlet.api.add),
				nsListKeys: outcome(() => Object.keys(host.slothlet).includes("api")),
				nsContextGetCall: outcome(() => host.slothlet.context.get()),
				protoCall: outcome(() => host.vault.Thing.prototype.read.call({ v: "h" })),
				construct: outcome(() => new host.vault.Thing("h").read()),
				handedRead: outcome(() => typeof handed.read),
				handedCall: outcome(() => handed.read.call({ v: "g" })),
				handedKeys: outcome(() => Reflect.ownKeys(handed).sort().join(",")),
				handedHas: outcome(() => "read" in handed),
				handedIsPrototype: outcome(() => handed === host.vault.Thing.prototype)
			}).toEqual({
				// The module was handed the prototype itself only while permissions are off.
				handedIsPrototype: combo.permissions === "off" ? "true" : "false",
				nsContextGet: "function",
				nsMetadata: "object",
				nsApiAdd: "function",
				nsListKeys: "true",
				nsContextGetCall: "[object Object]",
				protoCall: "h",
				construct: "h",
				handedRead: "function",
				handedCall: "g",
				handedKeys: "constructor,read",
				handedHas: "true"
			});
		});

		it("a reload after shutdown that fails leaves the instance shut down: what the module kept still uses nothing", async () => {
			// The guest is mounted from a copy that is gone by the time the reload replays the mount, so the reload fails
			// after its new copy has loaded.
			const copy = path.join(process.cwd(), "tmp", "shutdown-kept-handles", `${combo.mode}-${combo.runtime}-${combo.permissions}`);
			rmSync(copy, { recursive: true, force: true });
			mkdirSync(copy, { recursive: true });
			cpSync(path.join(KEPT_ROOT, "guest"), copy, { recursive: true });
			try {
				globalThis.__slothletShutdownKeptHandlesGate = { go: false, stop: false };
				api = await slothlet({
					base: path.join(KEPT_ROOT, "base"),
					mode: combo.mode,
					runtime: combo.runtime,
					silent: true,
					permissions: combo.permissions === "on" ? { mode: "on", policy: "allow" } : { mode: "off" }
				});
				await api.slothlet.api.add("guest", copy, { id: "guest" });
				await api.guest.keep.hold(path.join(KEPT_ROOT, "extra"));
				const host = api;
				await host.slothlet.shutdown();
				rmSync(copy, { recursive: true, force: true });
				await expect(host.slothlet.reload()).rejects.toThrow();

				const record = globalThis.__slothletShutdownKeptHandles;
				expect({ ...record.reads(), ...record.calls() }).toEqual({
					...Object.fromEntries(KEPT_USES.map((use) => [use, "!CONTEXT_NOT_ACTIVE_SELF"])),
					...(combo.permissions === "off" ? HELD_PROTOTYPE_USES : {})
				});
			} finally {
				rmSync(copy, { recursive: true, force: true });
			}
		});
	}
);
