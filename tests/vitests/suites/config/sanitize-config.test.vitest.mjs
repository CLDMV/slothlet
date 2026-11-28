/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/config/sanitize-config.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:21-08:00 (1795869081)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #814 — the `sanitize` config names files and folders while the api is built, not only in
 * `api.slothlet.sanitize()`. With `{ rules: { upper: ["*-ip"] } }`, `auto-ip.mjs` is `autoIP` and a folder
 * `net-ip/` is `netIP`, in eager and lazy, at init, through `api.slothlet.api.add()` (directory and single
 * file), after a reload, and in browser (manifest) mode. Without the config the names stay `autoIp` / `netIp`.
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import fsp from "node:fs/promises";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { generateManifest } from "#helpers/generate-manifest";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const SANITIZE = { rules: { upper: ["*-ip"] } };

let root;
let manifest;

beforeAll(async () => {
	root = await makeTestTmpDir("sanitize-config");
	await fsp.mkdir(path.join(root, "net-ip"), { recursive: true });
	await fsp.mkdir(path.join(root, "extra"), { recursive: true });
	await fsp.writeFile(
		path.join(root, "auto-ip.mjs"),
		'export function first() { return "first"; }\nexport function second() { return "second"; }\n'
	);
	await fsp.writeFile(
		path.join(root, "net-ip", "info.mjs"),
		'export function one() { return "one"; }\nexport function two() { return "two"; }\n'
	);
	await fsp.writeFile(
		path.join(root, "extra", "dns-ip.mjs"),
		'export function lookup() { return "lookup"; }\nexport function reverse() { return "reverse"; }\n'
	);
	await fsp.writeFile(path.join(root, "solo-ip.mjs"), 'export function a() { return "a"; }\nexport function b() { return "b"; }\n');
	manifest = await generateManifest(root);
});

afterAll(async () => {
	if (root) await fsp.rm(root, { recursive: true, force: true });
});

describe.each(["eager", "lazy"])("sanitize config names loaded files and folders (#814) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a file and a folder are named by the sanitize config", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		expect(await api.autoIP.first()).toBe("first");
		expect(await api.netIP.info.one()).toBe("one");
		expect(api.autoIp).toBeUndefined();
		expect(api.netIp).toBeUndefined();
	});

	it("without the config the names stay on the defaults", async () => {
		api = await slothlet({ base: root, mode });
		expect(await api.autoIp.first()).toBe("first");
		expect(await api.netIp.info.one()).toBe("one");
		expect(api.autoIP).toBeUndefined();
	});

	it("api.slothlet.sanitize() and the loader agree", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		expect(api.slothlet.sanitize("auto-ip")).toBe("autoIP");
		expect(api.autoIP).toBeDefined();
	});

	it("a directory added with api.add() is named by the config", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		await api.slothlet.api.add("added", path.join(root, "extra"));
		expect(await api.added.dnsIP.lookup()).toBe("lookup");
		expect(api.added.dnsIp).toBeUndefined();
	});

	it("a single file added with api.add() mounts its members at the path and still loads under the config", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		await api.slothlet.api.add("single", path.join(root, "solo-ip.mjs"));
		expect(await api.single.a()).toBe("a");
		expect(await api.single.b()).toBe("b");
	});

	it("a directory holding that file names it by the config when added", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		await api.slothlet.api.add("whole", root);
		expect(await api.whole.soloIP.a()).toBe("a");
		expect(api.whole.soloIp).toBeUndefined();
	});

	it("the names survive a full reload and a scoped reload", async () => {
		api = await slothlet({ base: root, mode, sanitize: SANITIZE });
		await api.slothlet.api.add("added", path.join(root, "extra"), { id: "extra-mod" });
		await api.slothlet.reload();
		expect(await api.autoIP.first()).toBe("first");
		expect(await api.netIP.info.two()).toBe("two");
		expect(await api.added.dnsIP.reverse()).toBe("reverse");
		await api.slothlet.api.reload("extra-mod");
		expect(await api.added.dnsIP.lookup()).toBe("lookup");
		expect(api.added.dnsIp).toBeUndefined();
	});

	it("browser (manifest) mode names files and folders by the config", async () => {
		api = await slothlet({ base: root, loader: { files: manifest }, mode, sanitize: SANITIZE });
		expect(await api.autoIP.first()).toBe("first");
		expect(await api.netIP.info.one()).toBe("one");
		expect(api.autoIp).toBeUndefined();
	});
});
