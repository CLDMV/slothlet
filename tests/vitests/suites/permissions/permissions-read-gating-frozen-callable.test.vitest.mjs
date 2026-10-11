/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-read-gating-frozen-callable.test.vitest.mjs
 *	@Date: 2026-10-11T12:30:00-07:00 (1791747000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:30:00-07:00 (1791747000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Freezing a callable api node keeps its read gating (#580 review).
 *
 * @description
 * A frozen object must report its members' real values to every reader, so a frozen node holding its
 * members as plain values would hand them to a caller the rules deny. A callable node instead fixes each
 * member as an accessor whose getter reads through the node, permission check included, so the values
 * stay gated and live after `Object.freeze`. Its `length` and `name` keep answering the function's.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const VAULT = `
export default function vault(a, b) {
	return "vault:" + a + b;
}
export const key = "SECRET";
`;

const ROGUE = `
import { self } from "@cldmv/slothlet/runtime";
const attempt = (fn) => {
	try {
		return String(fn());
	} catch (error) {
		return /PERMISSION_DENIED/.test(error.message) ? "denied" : "error:" + error.message;
	}
};
export const direct = () => attempt(() => self.vault.key);
export const viaDescriptor = () =>
	attempt(() => {
		const descriptor = Object.getOwnPropertyDescriptor(self.vault, "key");
		return JSON.stringify(descriptor && ("value" in descriptor ? descriptor.value : descriptor.get.call(self.vault)));
	});
export const viaJson = () => attempt(() => JSON.stringify(self.vault));
export const freeze = () => attempt(() => Object.isFrozen(Object.freeze(self.vault)));
`;

describe.each(getMatrixConfigs({}))("Permissions > Read Gating > a frozen callable node > $name", ({ config }) => {
	let root;
	let api;

	beforeEach(async () => {
		root = resolve("tmp", `slothlet-frozen-gating-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(join(root, "vault"), { recursive: true });
		await writeFile(join(root, "vault", "vault.mjs"), VAULT);
		await writeFile(join(root, "rogue.mjs"), ROGUE);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		await rm(root, { recursive: true, force: true });
	});

	it("keeps a denied caller from the members' values, and the members live for the host", async () => {
		api = await slothlet({
			...config,
			base: root,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "vault.**", effect: "deny" }] }
		});
		expect(await api.vault(1, 2)).toBe("vault:12");
		expect(await api.vault.key).toBe("SECRET");
		const length = api.vault.length;
		const keys = Object.keys(api.vault);

		expect(() => Object.freeze(api.vault)).not.toThrow();
		expect(Object.isFrozen(api.vault)).toBe(true);

		expect(await api.rogue.direct()).toBe("denied");
		expect(await api.rogue.viaDescriptor()).not.toContain("SECRET");
		expect(await api.rogue.viaJson()).not.toContain("SECRET");

		// The host still reads the live members, and the node keeps answering as the function.
		expect(await api.vault.key).toBe("SECRET");
		expect(await api.vault(3, 4)).toBe("vault:34");
		expect(api.vault.length).toBe(length);
		expect(Object.keys(api.vault)).toEqual(keys);
	});

	it("keeps every member for the host when a caller denied some of them freezes the node", async () => {
		api = await slothlet({
			...config,
			base: root,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "vault.**", effect: "deny" }] }
		});
		expect(await api.vault.key).toBe("SECRET");
		const keys = Object.keys(api.vault);
		expect(keys).toContain("key");

		expect(await api.rogue.freeze()).toBe("true");
		expect(await api.rogue.direct()).toBe("denied");

		expect(Object.keys(api.vault)).toEqual(keys);
		expect(await api.vault.key).toBe("SECRET");
	});
});
