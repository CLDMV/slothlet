/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/typescript/typescript-internal-edges.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:08-08:00 (1795869188)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Edges of `processors/typescript`: the version reported when the compiler API is missing, the stale
 * fallback-root sweep when the temp directory cannot be read or an entry is not what its name says, and the one-take
 * rule of the module's internal bindings.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/** A PID no process holds (beyond Linux's pid_max), so a root named for it reads as stale. */
const DEAD_PID = 999999999;

/**
 * A `typescript` namespace with no compiler API, with the keys declared so the mock's export guard lets them be read.
 * @param {*} top - The namespace's own `version`.
 * @param {*} wrapped - The `default` wrapper (an object with a version, or nothing).
 * @returns {object} The factory result.
 */
const noCompilerApi = (top, wrapped) => ({ version: top, default: wrapped, createProgram: undefined, ScriptTarget: undefined });

/**
 * Ask a fresh copy of the module for the compiler API and return what it refuses with.
 * @returns {Promise<Error>} The refusal.
 */
async function refusal() {
	vi.resetModules();
	const { getTypeScript } = await import("#processors/typescript");
	let caught;
	await withSuppressedSlothletErrorOutput(async () => {
		try {
			await getTypeScript();
		} catch (error) {
			caught = error;
		}
	});
	return caught;
}

describe("processors/typescript > a typescript install with no compiler API", () => {
	afterEach(() => {
		vi.doUnmock("typescript");
		vi.resetModules();
	});

	it("names the version the default wrapper reports when the namespace has none of its own", async () => {
		vi.doMock("typescript", () => noCompilerApi(undefined, { version: "7.3.0-wrapped" }));
		const error = await refusal();
		expect(error.code).toBe("TYPESCRIPT_STRICT_REQUIRES_TS6");
		expect(error.message).toContain("7.3.0-wrapped");
	});

	it("names the version as unknown when neither the namespace nor its default wrapper has one", async () => {
		vi.doMock("typescript", () => noCompilerApi(undefined, undefined));
		const error = await refusal();
		expect(error.code).toBe("TYPESCRIPT_STRICT_REQUIRES_TS6");
		expect(error.message).toContain("unknown");
	});
});

describe("processors/typescript > the stale fallback-root sweep", () => {
	const made = [];
	let previousTmp;

	afterEach(() => {
		vi.doUnmock("fs");
		vi.resetModules();
		if (previousTmp !== undefined) process.env.TMPDIR = previousTmp;
		previousTmp = undefined;
		for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
	});

	it("does nothing when the system temp directory cannot be read", async () => {
		const { sweepStaleFallbackRoots } = await import("#processors/typescript");
		previousTmp = process.env.TMPDIR ?? "";
		process.env.TMPDIR = path.join(os.tmpdir(), "slothlet-cov-missing-tmp-dir");
		await expect(sweepStaleFallbackRoots()).resolves.toBeUndefined();
	});

	it("leaves an entry alone when it is no directory of this user's by the time it is checked", async () => {
		const stale = path.join(os.tmpdir(), `slothlet-${DEAD_PID}-cOv9Zq`);
		fs.mkdirSync(stale, { recursive: true, mode: 0o700 });
		made.push(stale);
		const real = await import("node:fs");
		const lstatSync = (target, ...rest) => {
			if (String(target) === stale) return { isDirectory: () => true, uid: (process.getuid?.() ?? 0) + 1, mtimeMs: 0 };
			return real.lstatSync(target, ...rest);
		};
		vi.resetModules();
		vi.doMock("fs", () => ({ ...real, default: { ...real.default, lstatSync }, lstatSync }));
		const { sweepStaleFallbackRoots } = await import("#processors/typescript");
		await sweepStaleFallbackRoots();
		expect(fs.existsSync(stale)).toBe(true);
	});
});

describe("processors/typescript > internal bindings", () => {
	it("hands them to the host's entry once and refuses the same file a second time and any other file", async () => {
		const mod = await import(
			/* @vite-ignore */ new URL("../../../../src/lib/processors/typescript.mjs?internals-copy", import.meta.url).href
		);
		expect(typeof mod.internals("slothlet").releaseSecureFallbackRoot).toBe("function");
		expect(() => mod.internals("slothlet")).toThrow();
		expect(() => mod.internals("lib/other")).toThrow();
	});
});
