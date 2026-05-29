/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/manifest-helpers.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Direct unit tests for the browser-manifest helpers.
 *
 * @description
 * `createManifestResolver` and `generateManifest` are exercised indirectly by
 * the browser integration suite via the happy path (valid manifest + valid base).
 * This file targets the validation throws, empty-directory handling, prefix
 * skipping, and base-URL normalisation branches that the integration tests
 * do not reach.
 *
 * @module tests/vitests/suites/helpers/manifest-helpers
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── createManifestResolver ──────────────────────────────────────────────────

describe("createManifestResolver — input validation", () => {
	it("throws TypeError when base is null", () => {
		expect(() => createManifestResolver(null)).toThrow(TypeError);
		expect(() => createManifestResolver(null)).toThrow(/base must be a string or URL/);
	});

	it("throws TypeError when base is undefined", () => {
		expect(() => createManifestResolver(undefined)).toThrow(TypeError);
	});

	it("throws TypeError when base is a number", () => {
		expect(() => createManifestResolver(42)).toThrow(TypeError);
		expect(() => createManifestResolver(42)).toThrow(/received number/);
	});

	it("throws TypeError when base is a plain object (not URL instance)", () => {
		expect(() => createManifestResolver({})).toThrow(TypeError);
	});
});

describe("createManifestResolver — base URL normalisation", () => {
	it("accepts a string base and resolves relative paths", () => {
		const resolver = createManifestResolver("https://example.com/app/");
		const out = resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" });
		expect(out).toBe("https://example.com/app/math.mjs");
	});

	it("accepts a URL instance base and resolves relative paths", () => {
		const resolver = createManifestResolver(new URL("https://example.com/app/"));
		const out = resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" });
		expect(out).toBe("https://example.com/app/math.mjs");
	});

	it("strips trailing-filename segment when base does not end with a slash", () => {
		// e.g. import.meta.url usually points at a file, not a directory — the
		// helper should normalise it so relative resolution is directory-like.
		const resolver = createManifestResolver("https://example.com/app/entry.mjs");
		const out = resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" });
		expect(out).toBe("https://example.com/app/math.mjs");
	});

	it("preserves base when it already ends with a slash", () => {
		const resolver = createManifestResolver("https://example.com/app/api/");
		const out = resolver({ path: "auth.mjs", name: "auth", fullName: "auth.mjs" });
		expect(out).toBe("https://example.com/app/api/auth.mjs");
	});

	it("resolves nested relative paths", () => {
		const resolver = createManifestResolver("https://example.com/app/");
		const out = resolver({ path: "utils/format.mjs", name: "format", fullName: "format.mjs" });
		expect(out).toBe("https://example.com/app/utils/format.mjs");
	});

	it("works with file:// URLs", () => {
		const resolver = createManifestResolver("file:///tmp/api/");
		const out = resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" });
		expect(out).toBe("file:///tmp/api/math.mjs");
	});
});

// ─── generateManifest ────────────────────────────────────────────────────────

describe("generateManifest — input validation", () => {
	it("rejects when dir is missing", async () => {
		await expect(generateManifest()).rejects.toThrow(/dir must be a non-empty string/);
	});

	it("rejects when dir is null", async () => {
		await expect(generateManifest(null)).rejects.toThrow(/dir must be a non-empty string/);
	});

	it("rejects when dir is an empty string", async () => {
		await expect(generateManifest("")).rejects.toThrow(/dir must be a non-empty string/);
	});

	it("rejects when dir is a number", async () => {
		await expect(generateManifest(42)).rejects.toThrow(/received number/);
	});
});

describe("generateManifest — filesystem errors", () => {
	it("rejects when dir does not exist", async () => {
		await expect(generateManifest("/nonexistent/path/to/api")).rejects.toThrow(/cannot read directory/);
	});

	it("rejects when dir is a file (not a directory)", async () => {
		const root = await mkdtemp(join(tmpdir(), "slothlet-genmanifest-"));
		const filePath = join(root, "not-a-dir.txt");
		await writeFile(filePath, "hello");
		try {
			await expect(generateManifest(filePath)).rejects.toThrow(/is not a directory/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe("generateManifest — file filtering", () => {
	let root;

	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "slothlet-genmanifest-"));
		// Loadable: every supported extension
		await writeFile(join(root, "a.mjs"), "");
		await writeFile(join(root, "b.cjs"), "");
		await writeFile(join(root, "c.js"), "");
		await writeFile(join(root, "d.ts"), "");
		// Non-loadable extensions
		await writeFile(join(root, "readme.md"), "");
		await writeFile(join(root, "config.json"), "{}");
		// SKIP_PREFIXES — __ and .
		await writeFile(join(root, "__internal.mjs"), "");
		await writeFile(join(root, ".hidden.mjs"), "");
	});

	afterAll(async () => {
		if (root) await rm(root, { recursive: true, force: true });
	});

	it("includes all loadable extensions (.mjs, .cjs, .js, .ts) at root", async () => {
		const m = await generateManifest(root);
		const names = m.files.map((f) => f.name).sort();
		expect(names).toContain("a");
		expect(names).toContain("b");
		expect(names).toContain("c");
		expect(names).toContain("d");
	});

	it("excludes non-loadable extensions (.md, .json)", async () => {
		const m = await generateManifest(root);
		const names = m.files.map((f) => f.name);
		expect(names).not.toContain("readme");
		expect(names).not.toContain("config");
	});

	it("excludes files prefixed with __ or .", async () => {
		const m = await generateManifest(root);
		const names = m.files.map((f) => f.name);
		expect(names).not.toContain("__internal");
		expect(names).not.toContain(".hidden");
	});

	it("returns canonical file-entry shape { path, name, fullName }", async () => {
		const m = await generateManifest(root);
		for (const entry of m.files) {
			expect(typeof entry.path).toBe("string");
			expect(typeof entry.name).toBe("string");
			expect(typeof entry.fullName).toBe("string");
			expect(entry.fullName).toMatch(/\.(mjs|cjs|js|ts|mts|cts)$/);
		}
	});
});

describe("generateManifest — directory recursion and pruning", () => {
	let root;

	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "slothlet-genmanifest-"));

		// Nested directory with a loadable file — should be included
		const utilsDir = join(root, "utils");
		await mkdir(utilsDir, { recursive: true });
		await writeFile(join(utilsDir, "format.mjs"), "");

		// Empty directory — should be pruned (no children at all)
		await mkdir(join(root, "empty-dir"), { recursive: true });

		// Directory containing only non-loadable files — should be pruned
		const docsDir = join(root, "docs");
		await mkdir(docsDir, { recursive: true });
		await writeFile(join(docsDir, "guide.md"), "");
		await writeFile(join(docsDir, "config.json"), "");

		// Directory prefixed with __ — should be skipped entirely
		const internalDir = join(root, "__internal-dir");
		await mkdir(internalDir, { recursive: true });
		await writeFile(join(internalDir, "stuff.mjs"), "");
	});

	afterAll(async () => {
		if (root) await rm(root, { recursive: true, force: true });
	});

	it("includes nested directories that contain at least one loadable file", async () => {
		const m = await generateManifest(root);
		const dirNames = m.directories.map((d) => d.name);
		expect(dirNames).toContain("utils");
	});

	it("prunes directories that contain no loadable files (empty or docs-only)", async () => {
		const m = await generateManifest(root);
		const dirNames = m.directories.map((d) => d.name);
		expect(dirNames).not.toContain("empty-dir");
		expect(dirNames).not.toContain("docs");
	});

	it("skips directories with __ prefix entirely", async () => {
		const m = await generateManifest(root);
		const dirNames = m.directories.map((d) => d.name);
		expect(dirNames).not.toContain("__internal-dir");
	});

	it("returns canonical directory-entry shape { name, path, children }", async () => {
		const m = await generateManifest(root);
		for (const dir of m.directories) {
			expect(typeof dir.name).toBe("string");
			expect(typeof dir.path).toBe("string");
			expect(dir.children).toBeDefined();
			expect(Array.isArray(dir.children.files)).toBe(true);
			expect(Array.isArray(dir.children.directories)).toBe(true);
		}
	});

	it("uses forward-slash separators in paths (cross-platform)", async () => {
		const m = await generateManifest(root);
		const utilsDir = m.directories.find((d) => d.name === "utils");
		expect(utilsDir).toBeDefined();
		const formatFile = utilsDir.children.files.find((f) => f.name === "format");
		expect(formatFile).toBeDefined();
		expect(formatFile.path).toBe("utils/format.mjs");
	});
});
