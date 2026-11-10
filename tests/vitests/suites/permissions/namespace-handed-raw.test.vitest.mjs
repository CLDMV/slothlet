/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/namespace-handed-raw.test.vitest.mjs
 *	@Date: 2026-11-08T00:56:39-08:00 (1794128199)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T01:02:57-08:00 (1794128577)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The framework's namespace stays the framework's when the host hands it to a module as it holds it.
 *
 * @description
 * A module reading `self.slothlet` is handed a view that refuses its changes. A module can also come to hold the
 * namespace the host holds: passed as an argument, inside plain data, or stored on an object of the module's the
 * module then holds as itself (a class's prototype, say). The built-in write rules keep module code from changing it
 * however it reached it, with the permission system on or off; only `mode: "disabled"` leaves it open, and a host
 * rule lifts a rule for the callers it names. Checked in eager and lazy mode, async and live runtime.
 * @module tests/vitests/suites/permissions/namespace-handed-raw
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_namespace_handed");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "no permissions config", options: {} },
	{ name: "permissions on", options: { permissions: {} } },
	{ name: "permissions off", options: { permissions: { mode: "off" } } }
];

const CHANGES = ["assign", "define", "remove", "symbol", "deep", "deepRemove", "setPrototype", "close"];

/**
 * The same outcome for every change the holder makes.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The outcomes.
 */
const every = (outcome) => Object.fromEntries(CHANGES.map((change) => [change, outcome]));

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"the framework namespace handed to a module > $mode / $runtime",
	({ mode, runtime }) => {
		const instances = [];

		afterEach(async () => {
			for (const api of instances.splice(0)) await api.slothlet.shutdown();
		});

		/**
		 * Build an instance with the holder mounted beside the base.
		 * @param {object} options - Instance options.
		 * @returns {Promise<object>} The api.
		 */
		async function load(options) {
			const api = await slothlet({ base: join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			instances.push(api);
			await api.slothlet.api.add("holder", join(FIXTURE, "holder"), { moduleID: "holder" });
			return api;
		}

		describe.each(PERMISSIONS)("$name", ({ options }) => {
			it("refuses every change a module makes to the namespace the host handed it", async () => {
				const api = await load(options);
				const { version } = api.slothlet;
				expect(await api.holder.changeHanded(api.slothlet)).toEqual(every("PERMISSION_DENIED"));
				expect(api.slothlet.planted).toBeUndefined();
				expect(Object.hasOwn(api.slothlet, "defined")).toBe(false);
				expect(api.slothlet.version).toBe(version);
				expect(api.slothlet[Symbol.for("slothlet.test.namespaceHanded")]).toBeUndefined();
				expect(api.slothlet.api.planted).toBeUndefined();
				expect(typeof api.slothlet.api.add).toBe("function");
				expect(Object.getPrototypeOf(api.slothlet)).toBe(Object.prototype);
				expect(Object.isExtensible(api.slothlet)).toBe(true);
			});

			it("refuses a change to the namespace held inside plain data the host handed it", async () => {
				const api = await load(options);
				expect(await api.holder.changeBoxed({ ns: api.slothlet })).toBe("PERMISSION_DENIED");
				expect(api.slothlet.boxed).toBeUndefined();
			});

			it("lets the host change the namespace it holds", async () => {
				const api = await load(options);
				api.slothlet.hostOwn = 1;
				expect(api.slothlet.hostOwn).toBe(1);
				delete api.slothlet.hostOwn;
				expect(api.slothlet.hostOwn).toBeUndefined();
			});
		});

		it("lets a host rule lift the built-in rule for the module it names", async () => {
			const api = await load({ permissions: { rules: [{ caller: "holder.**", target: "slothlet.planted:write", effect: "allow" }] } });
			expect(await api.holder.changeHanded(api.slothlet)).toEqual({ ...every("PERMISSION_DENIED"), assign: "done" });
			expect(api.slothlet.planted).toBe(1);
		});

		it("leaves the namespace to a module with the permission system disabled", async () => {
			const api = await load({ permissions: { mode: "disabled" } });
			expect(await api.holder.changeBoxed({ ns: api.slothlet })).toBe("done");
			expect(api.slothlet.boxed).toBe(1);
		});
	}
);
