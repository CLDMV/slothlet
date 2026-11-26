/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-handler-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:30:00-08:00 (1795599000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:30-08:00 (1795600290)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Metadata handler arms the integration suites do not reach: the write paths of a run's copy,
 * removal bookkeeping for odd keys while a reload tracks changes, the impl fallback of a system-facts lookup,
 * a stand-in from another instance, and the caller-object fallback without a version manager.
 *
 * @module tests/vitests/suites/metadata/metadata-handler-arms.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { Metadata } from "#handlers/metadata";
import { WRITE_TARGET } from "#helpers/flow-stores";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { registerInstance, getInstanceToken } from "#handlers/lifecycle-token";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A slothlet stand-in registered for a lifecycle token.
 * @param {object} [extra] - Fields merged onto the mock.
 * @returns {{mock: object, token: symbol}} The mock and its token.
 * @example
 * const { mock, token } = makeMock();
 */
function makeMock(extra = {}) {
	const mock = { config: {}, debug: () => {}, SlothletError, SlothletWarning, helpers: { resolver: { path } }, ...extra };
	registerInstance(mock);
	return { mock, token: getInstanceToken(mock) };
}

describe("Metadata writes on a run's copy", () => {
	/**
	 * Two handlers, the first writing to the second.
	 * @returns {{meta: Metadata, copy: Metadata, token: symbol, target: Function}} The pair.
	 * @example
	 * const { meta, copy } = pair();
	 */
	function pair() {
		const { mock, token } = makeMock();
		const meta = new Metadata(mock);
		const copy = new Metadata(mock);
		const target = function leaf() {};
		meta.tagSystemMetadata(target, { moduleID: "m", apiPath: "a.leaf", filePath: "/x.mjs", sourceFolder: "/" }, token);
		copy.tagSystemMetadata(target, { moduleID: "m", apiPath: "a.leaf", filePath: "/x.mjs", sourceFolder: "/" }, token);
		mock[WRITE_TARGET] = (component) => (component === meta ? copy : component);
		return { meta, copy, token, target, mock };
	}

	it("setUserMetadata / removeUserMetadata write the copy", () => {
		const { meta, copy, target } = pair();
		meta.setUserMetadata(target, "k", 1);
		expect(copy.getMetadata(target)).toMatchObject({ k: 1 });
		expect(meta.getMetadata(target)).not.toHaveProperty("k");
		meta.removeUserMetadata(target, "k");
		expect(copy.getMetadata(target)).not.toHaveProperty("k");
	});

	it("setPathMetadata / removePathMetadata write the copy", () => {
		const { meta, copy } = pair();
		meta.setPathMetadata("a", "p", 2);
		expect(copy.getPathMetadata("a")).toMatchObject({ p: 2 });
		expect(meta.getPathMetadata("a") ?? {}).not.toHaveProperty("p");
		meta.removePathMetadata("a", "p");
		expect(copy.getPathMetadata("a") ?? {}).not.toHaveProperty("p");
	});

	it("importUserState / takeUserChanges write the copy", () => {
		const { meta, copy, mock } = pair();
		mock[WRITE_TARGET] = undefined;
		meta.setGlobalMetadata("g", 3);
		const state = meta.exportUserState();
		const fresh = new Metadata(mock);
		mock[WRITE_TARGET] = (component) => (component === fresh ? copy : component);
		fresh.importUserState(state);
		expect(copy.getMetadata()).toMatchObject({ g: 3 });
		expect(fresh.getMetadata()).not.toHaveProperty("g");
		const from = new Metadata(mock);
		from.trackUserChanges();
		from.setGlobalMetadata("h", 4);
		fresh.takeUserChanges(from);
		expect(copy.getMetadata()).toMatchObject({ h: 4 });
	});
});

describe("Metadata argument guards", () => {
	it("getMetadata() with no target is the global metadata", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		meta.setGlobalMetadata("app", "x");
		expect(meta.getMetadata(undefined)).toEqual({ app: "x" });
	});

	it("removeUserMetadata() refuses a primitive target", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		expect(() => meta.removeUserMetadata("str", "k")).toThrow(/METADATA_TARGET_INVALID/);
	});

	it("removePathMetadata() ignores an empty or non-string path", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		expect(meta.removePathMetadata("", "k")).toBeUndefined();
		expect(meta.removePathMetadata(5, "k")).toBeUndefined();
	});

	it("setUserMetadata() refuses a primitive target and setPathMetadata() an empty path", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		expect(() => meta.setUserMetadata("str", "k", 1)).toThrow(/METADATA_TARGET_INVALID/);
		expect(() => meta.setPathMetadata("", "k", 1)).toThrow(/INVALID_ARGUMENT/);
	});

	it("getMetadata() of a primitive that is no node is the global metadata", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		meta.setGlobalMetadata("app", "y");
		expect(meta.getMetadata("not.a.node")).toEqual({ app: "y" });
	});

	it("setModuleManifest() ignores a non-string module id", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		meta.setModuleManifest(7, { name: "x" });
		expect(meta.getModuleManifest(7)).toBeUndefined();
	});
});

describe("Metadata removal bookkeeping while a reload tracks changes", () => {
	it("notes only the string keys of an array and nothing for a key that is no key at all", () => {
		const { mock } = makeMock();
		const meta = new Metadata(mock);
		meta.setPathMetadata("a", { x: 1, y: 2 });
		meta.trackUserChanges();
		// A non-string element is refused, after the string ones before it are removed.
		expect(() => meta.removePathMetadata("a", ["x", 1])).toThrow(/METADATA_KEY_INVALID/);
		// A number is no key: refused.
		expect(() => meta.removePathMetadata("a", 42)).toThrow(/METADATA_KEY_INVALID/);
		const target = new Metadata(mock);
		target.setPathMetadata("a", { x: 9, y: 8 });
		target.takeUserChanges(meta);
		// Only `x` was removed in the tracked handler, so only `x` goes from the one taking its changes.
		expect(target.getPathMetadata("a")).toEqual({ y: 8 });
	});
});

describe("Metadata.getSystemMetadata — impl fallback", () => {
	it("answers the facts tagged on the node's impl when the node itself was never tagged", () => {
		const { mock, token } = makeMock();
		const meta = new Metadata(mock);
		const impl = { fn() {} };
		meta.tagSystemMetadata(impl, { moduleID: "m", apiPath: "a", filePath: "/a.mjs", sourceFolder: "/" }, token);
		const node = { ____slothletInternal: { impl } };
		expect(meta.getSystemMetadata(node)).toMatchObject({ apiPath: "a", baseModuleID: "m" });
	});
});

describe("Metadata.readThrough", () => {
	it("answers the facts of a node only the handler read through knows, until it is cleared", () => {
		const { mock, token } = makeMock();
		const previous = new Metadata(mock);
		const meta = new Metadata(mock);
		const fn = function known() {};
		previous.tagSystemMetadata(fn, { moduleID: "m", apiPath: "k", filePath: "/k.mjs", sourceFolder: "/" }, token);
		meta.readThrough(previous);
		expect(meta.getSystemMetadata(fn)).toMatchObject({ apiPath: "k" });
		// Reading through itself, or through nothing, is no read-through.
		meta.readThrough(meta);
		expect(meta.getSystemMetadata(fn)).toBeNull();
		meta.readThrough(previous);
		meta.readThrough(undefined);
		expect(meta.getSystemMetadata(fn)).toBeNull();
	});
});

describe("Metadata caller object without a version manager", () => {
	it("builds { path, module, metadata, version } from the system facts", () => {
		const leaf = function leaf() {};
		const { mock, token } = makeMock({
			instanceID: "meta-arms",
			contextManager: { tryGetContext: () => ({}), getCallerIdentity: () => ({ currentWrapper: leaf }) }
		});
		const meta = new Metadata(mock);
		meta.tagSystemMetadata(leaf, { moduleID: "pay", apiPath: "pay.charge", filePath: "/p.mjs", sourceFolder: "/" }, token);
		expect(meta.self()).toEqual({ path: ["pay", "charge"], module: "pay", metadata: {}, version: null });
	});

	it("answers an empty path and no module for a node slothlet never tagged", () => {
		const leaf = function untagged() {};
		const { mock } = makeMock({
			instanceID: "meta-arms-2",
			contextManager: { tryGetContext: () => ({}), getCallerIdentity: () => ({ currentWrapper: leaf }) }
		});
		const meta = new Metadata(mock);
		expect(meta.self()).toEqual({ path: [], module: null, metadata: {}, version: null });
	});
});

describe("Metadata of another instance's unloaded node", () => {
	const ROOT = path.join(process.cwd(), "tmp", "metadata-handler-arms");
	const BASE = path.join(ROOT, "api");

	beforeAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
		mkdirSync(path.join(BASE, "calls"), { recursive: true });
		writeFileSync(path.join(BASE, "calls", "calls.mjs"), `export function ping() {\n\treturn "pong";\n}\n`);
	});

	afterAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
	});

	it("is no node of this handler: no user metadata beyond the global", async () => {
		const api = await slothlet({ base: BASE, mode: "lazy", silent: true });
		try {
			const standIn = api.calls.ping;
			expect(api.slothlet.node(standIn).materialized).toBe(false);
			const { mock } = makeMock();
			const other = new Metadata(mock);
			other.setGlobalMetadata("only", "global");
			expect(other.getMetadata(standIn)).toEqual({ only: "global" });
			// The node the stand-in waits under, known to this handler with no path and no module of its own.
			const tagged = new Metadata(mock);
			tagged.tagSystemMetadata(resolveWrapper(api.calls), { filePath: "/c.mjs", sourceFolder: "/" }, getInstanceToken(mock));
			tagged.setGlobalMetadata("g", 1);
			expect(tagged.getMetadata(standIn)).toEqual({ g: 1 });
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
