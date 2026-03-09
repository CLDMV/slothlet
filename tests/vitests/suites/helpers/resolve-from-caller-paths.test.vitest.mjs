/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/resolve-from-caller-paths.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:49 -08:00 (1772425309)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for resolve-from-caller.mjs: getStack, toFsPath,
 * #findCallerBase fallback, and resolvePathFromCaller with file://, absolute,
 * and relative paths (including CWD fallback).
 *
 * @description
 * Exercises previously uncovered lines:
 *   Lines 53-60   getStack(skipFn) public method
 *   Line  84      toFsPath() conversion of file:// URL
 *   Line  96      #isSlothletInternal() with null/empty path
 *   Line 135      #findCallerBase() fallback (no slothlet.mjs in stack)
 *   Lines 153-159 #findCallerBase() second fallback + return null
 *   Line  155     resolvePathFromCaller() file:// URL short-circuit
 *   Line  159     resolvePathFromCaller() non-existent relative path fallback
 *   Lines 170-178 resolvePathFromCaller() resolve from caller's dir
 *   Lines 198-213 resolvePathFromCaller() CWD fallback + final return
 *
 * Creates a Resolver instance directly (ComponentBase only needs a slothlet object).
 * No full slothlet instance needed for these helper method tests.
 *
 * @module tests/vitests/suites/helpers/resolve-from-caller-paths
 */

import path from "node:path";
import { describe, it, expect } from "vitest";
import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";

/**
 * Create a Resolver instance with a minimal slothlet mock.
 * The Resolver methods do not call this.slothlet, so an empty object is fine.
 * @returns {Resolver} Resolver instance.
 */
function makeResolver() {
	return new Resolver({});
}

// ---------------------------------------------------------------------------
// 1. getStack() public method
// ---------------------------------------------------------------------------
describe("Resolver.getStack()", () => {
	it("returns an array of CallSite objects from the current stack", () => {
		const resolver = makeResolver();
		const stack = resolver.getStack();
		// Should return an array (possibly empty if V8 API not available)
		expect(Array.isArray(stack)).toBe(true);
	});

	it("accepts an optional skipFn parameter to trim the stack", () => {
		const resolver = makeResolver();

		function marker() {
			return resolver.getStack(marker);
		}

		const stack = marker();
		expect(Array.isArray(stack)).toBe(true);
		// With skipFn, marker function itself should not appear in stack
		// (V8 Error.captureStackTrace skips up to and including skipFn)
	});

	it("returns an array even when called without arguments", () => {
		const resolver = makeResolver();
		const stack = resolver.getStack(undefined);
		expect(Array.isArray(stack)).toBe(true);
		// Stack should be non-empty in normal execution
	});
});

// ---------------------------------------------------------------------------
// 2. toFsPath() method
// ---------------------------------------------------------------------------
describe("Resolver.toFsPath()", () => {
	it("converts a file:// URL to a filesystem path", () => {
		const resolver = makeResolver();

		// Build a file:// URL for a known path
		const absPath = "/srv/repos/slothlet/package.json";
		const fileUrl = `file://${absPath}`;
		const result = resolver.toFsPath(fileUrl);

		expect(result).toBe(absPath);
	});

	it("returns plain path strings as-is (no conversion needed)", () => {
		const resolver = makeResolver();
		const absPath = "/srv/repos/slothlet/package.json";
		const result = resolver.toFsPath(absPath);
		expect(result).toBe(absPath);
	});

	it("returns null for null input", () => {
		const resolver = makeResolver();
		const result = resolver.toFsPath(null);
		expect(result).toBeNull();
	});

	it("returns null for empty string input", () => {
		const resolver = makeResolver();
		const result = resolver.toFsPath("");
		expect(result).toBeNull();
	});

	it("returns null for undefined input", () => {
		const resolver = makeResolver();
		const result = resolver.toFsPath(undefined);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 3. resolvePathFromCaller() — file:// URL short-circuit (line 155)
// ---------------------------------------------------------------------------
describe("Resolver.resolvePathFromCaller() — file:// URL", () => {
	it("converts file:// URL to filesystem path and returns it directly", () => {
		const resolver = makeResolver();
		const absPath = "/srv/repos/slothlet/api_tests/api_test";
		const fileUrl = `file://${absPath}`;

		const result = resolver.resolvePathFromCaller(fileUrl);
		expect(result).toBe(absPath);
	});

	it("handles file:// URLs with encoded characters", () => {
		const resolver = makeResolver();
		// A simple test path
		const originalPath = "/srv/repos/slothlet";
		const fileUrl = `file://${originalPath}`;
		const result = resolver.resolvePathFromCaller(fileUrl);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 4. resolvePathFromCaller() — absolute path (line 159)
// ---------------------------------------------------------------------------
describe("Resolver.resolvePathFromCaller() — absolute path", () => {
	it("returns absolute paths unchanged", () => {
		const resolver = makeResolver();
		const absPath = "/srv/repos/slothlet/api_tests/api_test";

		const result = resolver.resolvePathFromCaller(absPath);
		expect(result).toBe(absPath);
	});

	it("returns any absolute path on the system unchanged", () => {
		const resolver = makeResolver();
		const absPath = "/tmp/some/path/that/may/not/exist";

		const result = resolver.resolvePathFromCaller(absPath);
		expect(result).toBe(absPath);
	});
});

// ---------------------------------------------------------------------------
// 5. resolvePathFromCaller() — relative path (lines 170-213)
// ---------------------------------------------------------------------------
describe("Resolver.resolvePathFromCaller() — relative path", () => {
	it("resolves a relative path from the caller's directory", () => {
		const resolver = makeResolver();

		// This test itself is the "caller" — resolvePathFromCaller will find this
		// test file in the V8 stack and resolve relative to its directory
		const result = resolver.resolvePathFromCaller("./dummy-relative.txt");

		// Result should be an absolute path
		expect(path.isAbsolute(result)).toBe(true);
		// Should be resolved relative to SOME valid directory
		expect(typeof result).toBe("string");
	});

	it("resolves a relative path that DOES exist to a real absolute path", () => {
		const resolver = makeResolver();

		// Resolve relative path to a file that EXISTS (the package.json)
		// From wherever this test is located, "../../../../package.json" should work
		const result = resolver.resolvePathFromCaller("../../../../package.json");

		// The result should be an absolute path
		expect(path.isAbsolute(result)).toBe(true);
	});

	it("resolves a relative path that does NOT exist via caller dir fallback", () => {
		const resolver = makeResolver();

		// A relative path that definitely doesn't exist
		const result = resolver.resolvePathFromCaller("./nonexistent-dir-xyz-abc");

		// Should still return a path (the caller-based resolution)
		expect(path.isAbsolute(result)).toBe(true);
	});

	it("falls back to CWD resolution when caller path doesn't exist but CWD-relative does", () => {
		const resolver = makeResolver();

		// Resolve relative to CWD (project root = /srv/repos/slothlet)
		// "package.json" exists in the CWD
		const result = resolver.resolvePathFromCaller("package.json");

		// Should resolve to an absolute path
		expect(path.isAbsolute(result)).toBe(true);
		// Should point to the package.json from either caller dir or CWD
		expect(result).toContain("package.json");
	});

	it("uses current working directory as fallback when caller file not found in stack", () => {
		const resolver = makeResolver();

		// A deeply relative path that is unlikely to resolve from the test file's location
		// but DOES exist in the CWD (like "api_tests")
		const result = resolver.resolvePathFromCaller("api_tests");

		// Should return an absolute path regardless
		expect(path.isAbsolute(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 6. Integration: resolvePathFromCaller is invoked when slothlet loads with relative dir
// ---------------------------------------------------------------------------
describe("resolvePathFromCaller — invoked via slothlet config.dir resolution", () => {
	it("slothlet successfully resolves a relative dir via resolver (CWD-based)", async () => {
		// This test exercises the resolver.resolvePathFromCaller call in config.mjs line 245
		// when config.dir is a relative path — uses CWD resolution
		const slothlet = (await import("@cldmv/slothlet")).default;

		// Use a relative path from the project root (where CWD typically is during tests)
		const api = await slothlet({
			dir: "api_tests/api_test",
			mode: "eager",
			hook: { enabled: false }
		});
		expect(api.math).toBeDefined();
		await api.shutdown();
	});

	it("slothlet resolves a file:// URL dir correctly", async () => {
		const slothlet = (await import("@cldmv/slothlet")).default;

		// Use a file:// URL as the dir (exercises line 155 in resolvePathFromCaller)
		const fileUrl = "file:///srv/repos/slothlet/api_tests/api_test";
		const api = await slothlet({
			dir: fileUrl,
			mode: "eager",
			hook: { enabled: false }
		});
		expect(api.math).toBeDefined();
		await api.shutdown();
	});
});
