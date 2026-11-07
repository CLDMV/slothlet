/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-vite-registry.test.vitest.mjs
 *	@Date: 2026-11-05T20:27:51-08:00 (1793939271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T21:30:02-08:00 (1793943002)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The registry slothlet keeps of the host files vite transformed (#714), and what it takes from it.
 * @description
 * The `slothletInstanceImports()` plugin appends to each of the host's own files a statement pushing an `Error` its
 * top-level code creates onto a global array. `installViteHostRegistry` fixes that array in place with a reader; the
 * reader takes a pushed error only when it is a native error with its stack unread, created by a file's own code that
 * vitest's or vite's runner was evaluating. Everything else pushed is dropped. The genuine case is covered by
 * `permissions-host-owner-vite`; these are the refusals.
 */

import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { installViteHostRegistry } from "#handlers/frame-placement";
import { VITE_HOST_SCRIPTS } from "@cldmv/slothlet/helpers/instance-imports";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const KEY = Symbol.for(VITE_HOST_SCRIPTS);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const HOST_FILE = path.join(ROOT, "api_tests", "api_test_host_owner_code", "host", "context.mjs");
const VITEST_EVALUATOR = path.join(ROOT, "node_modules", "vitest", "dist", "module-evaluator.js");
const scratch = makeTestTmpDirSync("i714-registry");

afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

/**
 * An error created by code compiled under `ownFile`, called from code compiled under `runnerFile`.
 * @param {string} ownFile - Where the creating code says it is.
 * @param {string} runnerFile - Where the calling code says it is.
 * @returns {Error} The error, its stack unread.
 */
const createdUnder = (ownFile, runnerFile) => {
	const own = vm.runInThisContext("() => new Error()", { filename: ownFile });
	const runner = vm.runInThisContext("(fn) => fn()", { filename: runnerFile });
	return runner(own);
};

/**
 * A fresh registry on a global object of its own, with `pending` already pushed before it was fixed.
 * @param {unknown[]} pending - What registrations pushed.
 * @returns {{target: object, registry: object}} The global object and the registry.
 */
const registryWith = (pending) => {
	const target = { [KEY]: pending };
	return { target, registry: installViteHostRegistry(target) };
};

describe("Permissions > the registry of the host's vite-transformed files (#714)", () => {
	it("fixes an array in place with a frozen reader, and is used as it is by another copy", () => {
		const target = {};
		const registry = installViteHostRegistry(target);
		const descriptor = Object.getOwnPropertyDescriptor(target, KEY);
		expect(descriptor.value).toBe(registry);
		expect([descriptor.writable, descriptor.configurable]).toEqual([false, false]);
		expect(Object.isFrozen(registry.registered)).toBe(true);
		expect(installViteHostRegistry(target)).toBe(registry);
		expect(registry.registered("nothing", "nothing")).toBe(false);
	});

	it("offers no registry when one without a reader is fixed in place", () => {
		const target = {};
		Object.defineProperty(target, KEY, { value: [], configurable: false });
		expect(installViteHostRegistry(target)).toBeNull();
	});

	it("does not read a Proxy put in the registry's place", () => {
		let read = false;
		const trap = new Proxy([new Error()], {
			get(array, key, receiver) {
				read = true;
				return Reflect.get(array, key, receiver);
			}
		});
		const { registry } = registryWith(trap);
		expect(registry.length).toBe(0);
		expect(read).toBe(false);
	});

	it("drops what is not a genuine, unread error created under vitest's or vite's runner", () => {
		const read = new Error();
		void read.stack;
		const rewritten = new Error();
		Object.defineProperty(rewritten, "stack", { get: () => "at host (/app/host.mjs:1:1)" });
		const manifestDir = path.join(scratch, "manifest-dir");
		fs.mkdirSync(path.join(manifestDir, "package.json"), { recursive: true });
		const nameless = path.join(scratch, "nameless");
		fs.mkdirSync(nameless, { recursive: true });
		fs.writeFileSync(path.join(nameless, "package.json"), JSON.stringify({ version: "1.0.0" }));
		const { registry } = registryWith([
			{ stack: "at host (/app/host.mjs:1:1)" },
			read,
			rewritten,
			// Created by code compiled from a string.
			eval("new Error()"),
			// Created by code naming a `node:` file, or slothlet's own.
			createdUnder("node:host", VITEST_EVALUATOR),
			createdUnder(path.join(ROOT, "src", "lib", "host.mjs"), VITEST_EVALUATOR),
			// Called from code that is not a runner's: no package, slothlet's package, a manifest that cannot be read or
			// names no package, and code compiled under vitest's runner file from another source.
			createdUnder(HOST_FILE, "/slothlet-i714-nowhere/runner.mjs"),
			createdUnder(HOST_FILE, path.join(ROOT, "tests", "runner.mjs")),
			createdUnder(HOST_FILE, path.join(manifestDir, "runner.mjs")),
			createdUnder(HOST_FILE, path.join(nameless, "runner.mjs")),
			createdUnder(HOST_FILE, VITEST_EVALUATOR),
			// Called from code compiled from a string.
			eval("((fn) => fn())")(vm.runInThisContext("() => new Error()", { filename: HOST_FILE }))
		]);
		expect(registry.length).toBe(12);
		expect(registry.registered(HOST_FILE, "any")).toBe(false);
		expect(registry.length).toBe(0);
	});

	it("drops an error created with no frame below its own", () => {
		const limit = Error.stackTraceLimit;
		Error.stackTraceLimit = 1;
		let alone;
		try {
			alone = vm.runInThisContext("new Error()", { filename: HOST_FILE });
		} finally {
			Error.stackTraceLimit = limit;
		}
		const { registry } = registryWith([alone]);
		expect(registry.registered(HOST_FILE, "any")).toBe(false);
	});
});
