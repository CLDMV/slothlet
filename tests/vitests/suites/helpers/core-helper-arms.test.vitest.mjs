/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/core-helper-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:34:04-08:00 (1795599244)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T20:32:42-08:00 (1795667562)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Helper arms the suites do not reach: an inherited member read by `dataMemberOf`, a second take of
 * reserved-keys' internals, a routines group given as an array or with null entries, option-key checks on an object
 * with a foreign prototype, an override manifest with no format field, and translations rendered with null params or
 * an index into a value that is no list.
 *
 * @module tests/vitests/suites/helpers/core-helper-arms.test.vitest
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { dataMemberOf, internals as reservedKeysInternals } from "#helpers/reserved-keys";
import { assertKnownKeys } from "#helpers/config-schema";
import { discoverModules } from "#helpers/module-discovery";
import { registerWarningClass, translate } from "#i18n";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { Resolver } from "#helpers/resolve-from-caller";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("reserved-keys", () => {
	it("dataMemberOf reads an inherited member through the owner", () => {
		const owner = Object.create({ inherited: 7 });
		expect(dataMemberOf(owner, "inherited")).toBe(7);
		expect(dataMemberOf(owner, "missing")).toBeUndefined();
	});

	it("refuses a second take of its internals by a file that already took them", async () => {
		await import("@cldmv/slothlet");
		expect(() => reservedKeysInternals("lib/handlers/unified-wrapper")).toThrow();
	});
});

describe("config — routines", () => {
	it("refuses a routines group given as an array", async () => {
		await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, silent: true, routines: ["initialize"] })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it("refuses routine entries that are no list", async () => {
		await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, silent: true, routines: { entries: "initialize" } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it("takes null routine entries as none", async () => {
		const api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, silent: true, routines: { entries: null } });
		try {
			expect(resolveWrapper(api.ping).____slothlet.config.routines.entries).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});

describe("config-schema — option objects with a foreign prototype", () => {
	it("checks the keys of an object with a null prototype and leaves a class instance alone", () => {
		const nullProto = Object.assign(Object.create(null), { bogus: 1 });
		expect(() => assertKnownKeys(nullProto, { known: true }, "test")).toThrow(
			expect.objectContaining({ code: "INVALID_CONFIG_UNKNOWN_KEY" })
		);
		class Options {
			bogus = 1;
		}
		expect(() => assertKnownKeys(new Options(), { known: true }, "test")).not.toThrow();
	});
});

describe("module-discovery — override manifest with no format field", () => {
	const ROOT = path.join(process.cwd(), "tmp", "core-helper-arms-discovery");

	beforeAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
		const pkg = path.join(ROOT, "node_modules", "app-plugin-a");
		mkdirSync(path.join(pkg, "api"), { recursive: true });
		writeFileSync(path.join(pkg, "api", "hello.mjs"), "export function hello() {\n\treturn 1;\n}\n");
		const old = path.join(ROOT, "node_modules", "app-plugin-b");
		mkdirSync(path.join(old, "api"), { recursive: true });
		writeFileSync(path.join(old, "api", "hello.mjs"), "export function hello() {\n\treturn 2;\n}\n");
		writeFileSync(
			path.join(old, "package.json"),
			JSON.stringify({
				name: "app-plugin-b",
				version: "1.0.0",
				app: { plugin: { mountPath: "ext.b", apiDir: "./api", kind: "extension" } }
			})
		);
		writeFileSync(
			path.join(pkg, "package.json"),
			JSON.stringify({ name: "app-plugin-a", version: "1.0.0", app: { plugin: { mount: ["ext", "a"], base: "./api", kind: "extension" } } })
		);
	});

	afterAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
	});

	it("is read as format 1 when it uses format 1 names, and as the current format otherwise", async () => {
		const results = await discoverModules({ root: ROOT, manifest: "package.json#app.plugin" }, { warn: () => {} });
		expect(results.map((r) => [r.package, r.manifest.schema, r.mount]).sort()).toEqual([
			["app-plugin-a", 2, ["ext", "a"]],
			["app-plugin-b", 2, ["ext", "b"]]
		]);
	});
});

describe("module-discovery — default scan root with no node_modules up to the filesystem root", () => {
	it("falls back to the working directory", async () => {
		const dir = mkdtempSync(path.join(os.tmpdir(), "slothlet-no-nm-"));
		const saved = process.cwd();
		try {
			process.chdir(dir);
			expect(await discoverModules()).toEqual([]);
		} finally {
			process.chdir(saved);
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("translations", () => {
	it("keeps the first warning class registered", () => {
		expect(() => registerWarningClass(class Other {})).not.toThrow();
	});

	it("renders a message with null params, its placeholders empty", () => {
		const message = translate("WARNING_MULTIPLE_ROOT_CONTRIBUTORS", null);
		expect(message).toContain("api.()");
	});

	it("renders an indexed placeholder of a value that is no list as empty", () => {
		const message = translate("WARNING_MULTIPLE_ROOT_CONTRIBUTORS", { contributors: "single" });
		expect(message).toContain("api.()");
		expect(message).toContain("single");
	});
});

describe("resolve-from-caller — a Node builtin's frame between slothlet and the caller", () => {
	it("passes over the builtin's frame to the caller's file", () => {
		const resolver = new Resolver(null);
		const resolved = new AsyncLocalStorage().run({}, resolver.resolvePathFromCaller.bind(resolver), ".");
		expect(resolved).toBe(path.dirname(fileURLToPath(import.meta.url)));
	});
});
