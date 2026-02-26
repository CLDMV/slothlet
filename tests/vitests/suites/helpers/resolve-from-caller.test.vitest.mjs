/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/resolve-from-caller.test.vitest.mjs
 *	@Date: 2026-02-26 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for Resolver.resolvePathFromCaller (resolve-from-caller.mjs).
 *
 * @description
 * Covers the uncovered branches in resolve-from-caller.mjs:
 * - Lines 153-159: slothletIndex === -1 block inside #findCallerBase (when slothlet.mjs is
 *   not present in the call stack, as in direct unit-test invocations).
 * - Lines 198-200: CWD fallback — when callerDir-resolved path does not exist on disk but
 *   cwd-resolved path does.
 * - Lines 193-194: Caller-dir resolution path fires when the resolved path exists on disk.
 * - toFsPath() falsy/file-url/plain-string paths (line 87-90).
 *
 * The Resolver class extends ComponentBase which takes a slothlet instance. For these
 * unit tests the slothlet instance is irrelevant (only path/stack logic is tested), so
 * `new Resolver(null)` is used throughout.
 *
 * @module tests/vitests/suites/helpers/resolve-from-caller.test.vitest
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Resolver.resolvePathFromCaller", () => {
	const resolver = new Resolver(null);

	// ─── Short-circuit: file:// URL ─────────────────────────────────────────

	it("should convert file:// URLs to filesystem paths immediately (line 173)", () => {
		const result = resolver.resolvePathFromCaller("file:///srv/repos/slothlet");
		expect(result).toBe("/srv/repos/slothlet");
	});

	// ─── Short-circuit: absolute path ───────────────────────────────────────

	it("should return absolute paths unchanged (line 174)", () => {
		const result = resolver.resolvePathFromCaller("/absolute/path/to/dir");
		expect(result).toBe("/absolute/path/to/dir");
	});

	// ─── slothletIndex === -1 branch (lines 153-159) ────────────────────────

	it("should resolve relative path when slothlet.mjs is NOT in the call stack (covers slothletIndex === -1 path)", () => {
		// Calling directly from a test file ensures slothlet.mjs is absent from the stack.
		// #findCallerBase() will set slothletIndex=-1, loop through stack files,
		// find this test file as the first non-internal file, and return its path.
		// resolvePathFromCaller("." ) then resolves to the test file's directory.
		const result = resolver.resolvePathFromCaller(".");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		// The resolved "." should point to a directory that contains this test file
		expect(result).toContain("slothlet");
	});

	// ─── Caller-dir resolution succeeds (lines 193-194) ────────────────────

	it("should resolve relative to caller directory when target exists on disk", () => {
		// "../../setup" relative to this test file's directory resolves to
		// /srv/repos/slothlet/tests/vitests/setup which DOES exist.
		// → fs.existsSync(resolved) = true → returns resolved path (lines 193-194)
		const result = resolver.resolvePathFromCaller("../../setup");
		expect(result).toBe(path.resolve(__dirname, "../../setup"));
	});

	// ─── CWD fallback (lines 198-200) ───────────────────────────────────────

	it("should fall back to CWD resolution when callerDir-resolved path does not exist but CWD-resolved does", () => {
		// "api_tests" relative to this test file's dir does NOT exist
		// (/tests/vitests/suites/helpers/api_tests doesn't exist).
		// "api_tests" at the cwd (/srv/repos/slothlet/api_tests) DOES exist.
		// → covers lines 198-200 (cwdResolved path)
		const result = resolver.resolvePathFromCaller("api_tests");
		expect(result).toBe(path.resolve(process.cwd(), "api_tests"));
	});

	it("should return the caller-dir resolution when neither callerDir nor CWD resolves to an existing path", () => {
		// Neither exists → falls through to final `return resolved` (last line)
		const result = resolver.resolvePathFromCaller("__does_not_exist_anywhere_xy123__");
		expect(typeof result).toBe("string");
		// Should still produce a consistent resolved path (not null/undefined)
		expect(result).toContain("__does_not_exist_anywhere_xy123__");
	});
});

describe("Resolver.toFsPath", () => {
	const resolver = new Resolver(null);

	it("should return null for falsy input (null)", () => {
		expect(resolver.toFsPath(null)).toBeNull();
	});

	it("should return null for falsy input (undefined)", () => {
		expect(resolver.toFsPath(undefined)).toBeNull();
	});

	it("should return null for empty string", () => {
		expect(resolver.toFsPath("")).toBeNull();
	});

	it("should convert file:// URLs to filesystem paths", () => {
		expect(resolver.toFsPath("file:///srv/repos/slothlet")).toBe("/srv/repos/slothlet");
	});

	it("should return plain strings unchanged", () => {
		expect(resolver.toFsPath("/some/plain/path")).toBe("/some/plain/path");
	});
});
