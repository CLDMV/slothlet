/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/frozen-node-permissions.test.vitest.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T21:31:56-07:00 (1791865916)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Freezing a namespace or array api node keeps its permission checks (#609).
 *
 * @description
 * Fixture `api_test_frozen_permissions`:
 * ```
 * secrets.mjs   key = "SECRET", list = ["a", "b"]
 * rogue.mjs     readSecrets(), readList(list): each read of the member, its descriptor and JSON.stringify
 * ```
 * Rule: `rogue.**` is denied `secrets.**`. A frozen object must report each plain-value member's real
 * value to every reader, so a node whose own target held its members would hand them to the denied
 * caller once frozen. A node's target is a shell, and freezing fixes each member there as an accessor
 * whose getter runs the node's read, permission check included. The host keeps reading live values.
 *
 * @module tests/vitests/suites/permissions/frozen-node-permissions
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_frozen_permissions", import.meta.url).pathname;
const PERMISSIONS = { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "secrets.**", effect: "deny" }] };

/**
 * Whether any outcome handed over a protected value.
 * @param {object} outcomes - The reads' outcomes.
 * @param {string} secret - The protected value.
 * @returns {boolean} True when a read gave it.
 */
const leaked = (outcomes, secret) => Object.values(outcomes).some((outcome) => JSON.stringify(outcome.value ?? null).includes(secret));

describe.each(getMatrixConfigs({}))("frozen node permissions (#609) > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a denied caller cannot read a frozen namespace's members, and the host still can", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		expect(leaked(await api.rogue.readSecrets(), "SECRET")).toBe(false);
		Object.freeze(api.secrets);
		expect(Object.isFrozen(api.secrets)).toBe(true);
		const outcomes = await api.rogue.readSecrets();
		expect(leaked(outcomes, "SECRET")).toBe(false);
		expect(outcomes.direct.error).toBe("PERMISSION_DENIED");
		expect(outcomes.descriptor.error).toBe("PERMISSION_DENIED");
		expect(outcomes.json.error).toBe("PERMISSION_DENIED");
		expect(api.secrets.key).toBe("SECRET");
	});

	it("a denied caller cannot read a frozen array member's elements, and the host still can", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		const list = api.secrets.list;
		expect(leaked(await api.rogue.readList(list), '"a"')).toBe(false);
		Object.freeze(list);
		expect(Object.isFrozen(list)).toBe(true);
		const outcomes = await api.rogue.readList(list);
		expect(leaked(outcomes, '"a"')).toBe(false);
		expect(outcomes.direct.error).toBe("PERMISSION_DENIED");
		expect(outcomes.descriptor.error).toBe("PERMISSION_DENIED");
		expect(outcomes.json.error).toBe("PERMISSION_DENIED");
		expect(list[0]).toBe("a");
		expect([...list]).toEqual(["a", "b"]);
	});
});
