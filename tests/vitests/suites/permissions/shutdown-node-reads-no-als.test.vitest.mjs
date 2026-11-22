/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/shutdown-node-reads-no-als.test.vitest.mjs
 *	@Date: 2026-11-21T22:07:36-08:00 (1795327656)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T22:28:19-08:00 (1795328899)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview On a host with no AsyncLocalStorage (a browser), what a module kept uses nothing once its instance has
 * shut down, and a reload after the shutdown that fails leaves it so.
 *
 * @description
 * Run with `AsyncLocalStorage` taken away from slothlet's platform layer, on the live runtime, eager and lazy,
 * permissions on and off. There a reload cannot keep its build apart from the instance: the build replaces the
 * instance's own state, and what it had is put back when the reload fails. The guest (`api_test_shutdown_kept_handles`)
 * keeps the framework's namespace it read through `self`, a class node and the class's prototype; once the instance has
 * shut down every use of them from a function the module handed out is refused, as a read of `self` itself is. The guest
 * is mounted from a copy that is gone by the time the reload replays the mount, so the reload fails after its new copy
 * has loaded; the instance stays shut down and the uses stay refused.
 */
import path from "node:path";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncLocalStorage: null }));

const KEPT_ROOT = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_shutdown_kept_handles");

const COMBOS = [];
for (const mode of ["eager", "lazy"])
	for (const permissions of ["on", "off"]) COMBOS.push({ name: `${mode}/live/permissions ${permissions}`, mode, permissions });

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
	"Permissions > with no AsyncLocalStorage, what a module kept uses nothing once its instance has shut down > $name",
	(combo) => {
		let api;
		const copy = path.join(process.cwd(), "tmp", "shutdown-kept-handles-no-als", `${combo.mode}-${combo.permissions}`);

		afterEach(async () => {
			const gate = globalThis.__slothletShutdownKeptHandlesGate;
			if (gate) gate.stop = true;
			await api?.slothlet.shutdown().catch(() => {});
			api = undefined;
			rmSync(copy, { recursive: true, force: true });
			await new Promise((resolve) => {
				setTimeout(resolve, 5);
			});
			delete globalThis.__slothletShutdownKeptHandlesGate;
			delete globalThis.__slothletShutdownKeptHandles;
		});

		/**
		 * What every use gives once the instance has shut down: refused, but for the prototype the module holds itself
		 * while permissions are off, which reads as a plain object does.
		 * @returns {Object<string, string>} The outcomes by use.
		 */
		const refused = () => ({
			...Object.fromEntries(KEPT_USES.map((use) => [use, "!CONTEXT_NOT_ACTIVE_SELF"])),
			...(combo.permissions === "off" ? HELD_PROTOTYPE_USES : {})
		});

		it("after shutdown every use is refused, and a failed reload after it leaves them refused", async () => {
			rmSync(copy, { recursive: true, force: true });
			mkdirSync(copy, { recursive: true });
			cpSync(path.join(KEPT_ROOT, "guest"), copy, { recursive: true });
			globalThis.__slothletShutdownKeptHandlesGate = { go: false, stop: true };
			api = await slothlet({
				base: path.join(KEPT_ROOT, "base"),
				mode: combo.mode,
				runtime: "live",
				silent: true,
				permissions: combo.permissions === "on" ? { mode: "on", policy: "allow" } : { mode: "off" }
			});
			await api.slothlet.api.add("guest", copy, { id: "guest" });
			await api.guest.keep.hold(path.join(KEPT_ROOT, "extra"));
			const host = api;
			const record = globalThis.__slothletShutdownKeptHandles;
			await host.slothlet.shutdown();
			expect({ ...record.reads(), ...record.calls() }).toEqual(refused());

			rmSync(copy, { recursive: true, force: true });
			await expect(host.slothlet.reload()).rejects.toThrow();
			expect({ ...record.reads(), ...record.calls() }).toEqual(refused());
		});
	}
);
