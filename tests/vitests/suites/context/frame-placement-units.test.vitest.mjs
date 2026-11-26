/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/frame-placement-units.test.vitest.mjs
 *	@Date: 2026-11-25T01:30:17-08:00 (1795599017)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:44:59-08:00 (1795599899)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frame placement's own helpers, called directly with values a test builds: entry-name matching, the
 * instance-code test for a stack, the load lookup by importer, and the plain-data search for code a caller hands in.
 *
 * @description
 * No slothlet instance is loaded in this file, so the checks the wrapper module registers keep their defaults: no
 * value is an api value, a result is handed back as it is, and nothing is a prototype handed to the host.
 *
 * @module tests/vitests/suites/context/frame-placement-units
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
	attributeResult,
	bareList,
	carriesCallerCode,
	enterCall,
	isUnverifiedCode,
	textFrames,
	handedLeafFunctions,
	isHandedOut,
	isHostPrototype,
	runtime_loadingFileRunning,
	runtime_namedAmong,
	runtime_namesEntry,
	setApiValueCheck,
	stackHoldsInstanceCode,
	toComparablePath
} from "#handlers/frame-placement";

const OWN_FILE = toComparablePath(import.meta.url);

/**
 * A source naming no live instance, with the given folders being built.
 * @param {Array<*>} roots - The folders.
 * @param {object|null} [slothlet=null] - A stand-in instance.
 * @returns {{family: string, slothlet: object|null, roots: Array<*>}} The source.
 */
const source = (roots, slothlet = null) => ({ family: "frame-placement-units", slothlet, roots });

/**
 * Run `fn` with `depth` more frames of this file on the stack.
 * @param {number} depth - Frames to add.
 * @param {Function} fn - What to run at the bottom.
 * @returns {*} What `fn` returned.
 */
function deep(depth, fn) {
	return depth <= 0 ? fn() : deep(depth - 1, fn);
}

describe("frame placement > entry names", () => {
	it("names nothing for a frame with no function text", () => {
		expect(runtime_namesEntry("", { fnNames: ["run"] })).toBe(false);
	});

	it("matches a single name, and nothing for an entry with no names", () => {
		expect(runtime_namesEntry("at run", { fnName: "run" })).toBe(true);
		expect(runtime_namesEntry("at walk", { fnName: "run" })).toBe(false);
		expect(runtime_namesEntry("at run", {})).toBe(false);
	});

	it("names no calls for a frame with no function text", () => {
		expect(Array.from(runtime_namedAmong([{ fnNames: ["run"] }], ""))).toEqual([]);
	});

	it("keeps each call the frame names, among several groups of names", () => {
		const a = { fnNames: ["x", "run"] };
		const b = { fnNames: ["run", "y"] };
		const c = { fnName: "other" };
		const d = { fnName: "other" };
		const list = bareList();
		for (const entry of [a, b, c, d]) list[list.length] = entry;
		expect(Array.from(runtime_namedAmong(list, "at run"))).toEqual([a, b]);
		expect(Array.from(runtime_namedAmong(list, "at other"))).toEqual([c, d]);
		// Answered again from what was found the first time.
		expect(Array.from(runtime_namedAmong(list, "at run"))).toEqual([a, b]);
	});
});

describe("frame placement > instance code on the stack", () => {
	it("owns nothing by an empty, non-string or root folder", () => {
		expect(stackHoldsInstanceCode([source(["", 5, null, "/", "/.."])])).toBe(false);
	});

	it("collapses a relative folder's leading parent steps and still matches no frame of this file", () => {
		expect(stackHoldsInstanceCode([source(["a/../../b", "./c/./d"])])).toBe(false);
	});

	it("holds this file's code when a folder being built holds it", () => {
		const folder = OWN_FILE.slice(0, OWN_FILE.lastIndexOf("/"));
		expect(stackHoldsInstanceCode([source([folder + "/../" + folder.slice(folder.lastIndexOf("/") + 1)])])).toBe(true);
	});

	it("holds this file's code when the instance's loader imported it", () => {
		const loader = { importedLocations: () => [import.meta.url] };
		expect(stackHoldsInstanceCode([source([], { processors: { loader } })])).toBe(true);
	});

	it("reads no locations from a loader that records none", () => {
		expect(stackHoldsInstanceCode([source([], { processors: { loader: {} } })])).toBe(false);
	});

	it("reads a stack deeper than the first capture in full", () => {
		expect(deep(260, () => stackHoldsInstanceCode([source([])]))).toBe(false);
		const loader = { importedLocations: () => ["file:///nowhere/else.mjs"] };
		expect(deep(260, () => stackHoldsInstanceCode([source([], { processors: { loader } })]))).toBe(false);
	});
});

describe("frame placement > a load by its importer", () => {
	it("has no load without a loader that tells one", () => {
		expect(runtime_loadingFileRunning(null)).toBeNull();
		expect(runtime_loadingFileRunning({ processors: { loader: {} } })).toBeNull();
	});

	it("takes a malformed mount tag as spelled", () => {
		const loader = { loadingFile: (path, mount) => ({ path, mount }) };
		expect(runtime_loadingFileRunning({ processors: { loader } }, "file:///srv/app/api/a.mjs?module=%E0%A4%A")).toEqual({
			path: "/srv/app/api/a.mjs",
			mount: "%E0%A4%A"
		});
		expect(runtime_loadingFileRunning({ processors: { loader } }, "file:///srv/app/api/a.mjs?module=one+two%21")).toEqual({
			path: "/srv/app/api/a.mjs",
			mount: "one two!"
		});
	});
});

describe("frame placement > plain data", () => {
	afterEach(() => {
		setApiValueCheck(() => false);
	});

	it("takes a frozen object of another prototype as able to carry code", () => {
		expect(carriesCallerCode(Object.freeze(new Map()), [])).toBe(true);
		expect(carriesCallerCode(undefined, [Object.freeze(Object.create({ inherited: 1 }))])).toBe(true);
	});

	it("takes frozen data past the property budget as able to carry code", () => {
		const wide = {};
		for (let i = 0; i < 600; i++) wide[`k${i}`] = i;
		Object.freeze(wide);
		expect(carriesCallerCode(wide, null)).toBe(true);
		const small = Object.freeze({ a: 1 });
		expect(carriesCallerCode(small, null)).toBe(false);
	});

	it("takes a module namespace whose binding is not initialised yet as able to carry code", async () => {
		globalThis.__framePlacementCheck = (namespace) => ({
			carries: carriesCallerCode(namespace, []),
			// Entered with the namespace as a wrapper's impl: its uninitialised `default` is no leaf function to match.
			entered: enterCall({ ____slothletInternal: { impl: namespace } }, (value) => value * 2, undefined, [21])
		});
		try {
			const { early } = await import("./fixtures/frame-placement-tdz-namespace.mjs");
			expect(early).toEqual({ carries: true, entered: 42 });
		} finally {
			delete globalThis.__framePlacementCheck;
		}
	});

	it("asks the registered check whether an api value holds code", () => {
		const apiValue = {};
		setApiValueCheck((value) => value === apiValue);
		expect(carriesCallerCode(apiValue, [])).toBe(false);
		setApiValueCheck(
			(value) => value === apiValue,
			() => true
		);
		expect(carriesCallerCode(apiValue, [])).toBe(true);
	});

	it("finds no leaf function in values no instance knows", () => {
		expect(handedLeafFunctions(() => 1, null)).toBeNull();
		const long = new Array(600).fill(0);
		expect(handedLeafFunctions(undefined, [long])).toBeNull();
	});
});

describe("frame placement > a frame's own source", () => {
	const sha = (data) => createHash("sha256").update(data).digest("hex");
	let dir;

	afterEach(() => {
		if (dir) fs.rmSync(dir, { recursive: true, force: true });
		dir = null;
	});

	it("takes a frame with no script hash as running its file's source", () => {
		expect(isUnverifiedCode({ path: "/nowhere/a.mjs", hash: null, key: null }, { unverified: true })).toBe(false);
	});

	it("takes nothing as unverified that its placement does not mark so", () => {
		expect(isUnverifiedCode({ path: "/nowhere/a.mjs", hash: "ab", key: null }, { unverified: false })).toBe(false);
	});

	it("matches the source of a file written with a byte-order mark, with or without the mark", () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-frame-source-"));
		const file = path.join(dir, "bom.mjs");
		const body = Buffer.from("export const x = 1;\n");
		fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]));
		const frame = (hash) => ({ path: file, hash, key: null });
		expect(isUnverifiedCode(frame(sha(body)), { unverified: true })).toBe(false);
		expect(isUnverifiedCode(frame(sha("something else")), { unverified: true })).toBe(true);
	});

	it("reads a file again once it has changed since it was read", () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-frame-source-"));
		const file = path.join(dir, "edited.mjs");
		fs.writeFileSync(file, "export const x = 1;\n");
		const edited = "export const x = 2;\n";
		expect(isUnverifiedCode({ path: file, hash: sha(edited), key: null }, { unverified: true })).toBe(true);
		fs.writeFileSync(file, edited);
		const later = new Date(Date.now() + 5000);
		fs.utimesSync(file, later, later);
		expect(isUnverifiedCode({ path: file, hash: sha(edited), key: null }, { unverified: true })).toBe(false);
		// Unchanged since: not read again.
		expect(isUnverifiedCode({ path: file, hash: sha("other"), key: null }, { unverified: true })).toBe(true);
		fs.rmSync(file);
		// Gone since: its source cannot be the frame's.
		expect(isUnverifiedCode({ path: file, hash: sha("other again"), key: null }, { unverified: true })).toBe(true);
	});

	it("keeps answering past the number of files it remembers", () => {
		for (let i = 0; i < 4100; i++)
			expect(isUnverifiedCode({ path: `/nowhere/many-${i}.mjs`, hash: "ab", key: null }, { unverified: true })).toBe(true);
	});
});

describe("frame placement > text frames", () => {
	it("takes a function merely named like slothlet's entry functions as entering nothing", () => {
		const [frame] = textFrames("slothlet_enterOther@http://localhost/api/a.mjs:1:1", 10);
		expect(frame.enter).toBeNull();
		const [leaf] = textFrames("slothlet_enterLeaf@http://localhost/api/a.mjs:1:1", 10);
		expect(leaf.enter).toBe("leaf");
	});
});

describe("frame placement > defaults before the wrapper module registers its checks", () => {
	it("hands a result back as it is, and takes nothing for a host prototype or a stand-in", () => {
		const value = { made: true };
		expect(attributeResult({}, value)).toBe(value);
		expect(isHostPrototype({}, value)).toBe(false);
		expect(isHandedOut(value)).toBe(false);
	});
});
