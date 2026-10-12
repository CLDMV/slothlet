/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-prototype-named-paths.test.vitest.mjs
 *	@Date: 2026-10-11T12:53:56-07:00 (1791748436)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T17:01:55-07:00 (1791763315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A root folder or mount named like an `Object.prototype` member stays on the api (#580 review).
 *
 * @description
 * While the api root is built it is a plain object, which inherits `toString`, `hasOwnProperty` and the
 * rest of `Object.prototype`. Composition reading those as existing nodes wrote the folder's or mount's
 * members into the global builtin (`Object.prototype.toString.zip`), shared by every object in the
 * process. A member of the root is an own property only.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const NAMES = ["toString", "hasOwnProperty", "valueOf", "isPrototypeOf"];

/** Whether any of the prototype-named builtins gained a member. @returns {string[]} The leaked paths. */
const leaked = () =>
	NAMES.flatMap((name) => ["zip", "zap"].filter((member) => member in Object(Object.prototype[name])).map((member) => `${name}.${member}`));

describe.each(getMatrixConfigs({}))("A path named like an Object.prototype member > $name", ({ config }) => {
	let root;
	let api;

	beforeEach(async () => {
		root = resolve("tmp", `slothlet-proto-paths-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		for (const name of NAMES) {
			await mkdir(join(root, "boot", name), { recursive: true });
			await writeFile(join(root, "boot", name, "zip.mjs"), `export const zip = () => "${name}.zip";\n`);
		}
		await mkdir(join(root, "mount"), { recursive: true });
		await mkdir(join(root, "plain"), { recursive: true });
		await writeFile(join(root, "plain", "keep.mjs"), `export const keep = () => "keep";\n`);
		await writeFile(join(root, "mount", "zap.mjs"), `export const zap = () => "zap";\n`);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		for (const name of NAMES) {
			delete Object.prototype[name].zip;
			delete Object.prototype[name].zap;
		}
		await rm(root, { recursive: true, force: true });
	});

	it("a root folder of that name is an api member, and the builtin is left alone", async () => {
		api = await slothlet({ ...config, base: join(root, "boot") });
		for (const name of NAMES) expect(await api[name].zip()).toBe(`${name}.zip`);
		expect(leaked()).toEqual([]);
	});

	it("a mount under that name at the root is an api member, and the builtin is left alone", async () => {
		// A base with no such folder, so the mount creates the node at the root itself.
		api = await slothlet({ ...config, base: join(root, "plain"), api: { ...config.api, mutations: { add: true } } });
		for (const name of NAMES) {
			await api.slothlet.api.add(`${name}.extra`, join(root, "mount"));
			expect(await api[name].extra.zap()).toBe("zap");
		}
		expect(leaked()).toEqual([]);
	});
});
