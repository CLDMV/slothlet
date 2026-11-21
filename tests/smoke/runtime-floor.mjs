/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/smoke/runtime-floor.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T00:00:00-08:00 (1794902400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Plain-Node smoke check for slothlet's runtime floor (`engines.node`).
 *
 * CI's test matrix starts at the dev floor (`devEngines`), because vitest and the build toolchain
 * need a newer Node than the package itself. This script needs nothing but Node and the package, so
 * it is run by hand on the runtime floor (Node 22.15.0) to cover the versions in between. It loads slothlet through the
 * ESM and CJS entries, builds a small api in eager and lazy mode, calls leaves (one reaching a
 * sibling through `self`), imports `@cldmv/slothlet/runtime`, boots once with permissions on, and
 * shuts every instance down. It also runs an AsyncContextFrame canary: with AsyncContextFrame off,
 * an AsyncLocalStorage store is reachable from the current async resource; with it on, it is not.
 *
 * Run against src with `node --conditions=slothlet-dev tests/smoke/runtime-floor.mjs`, or against the
 * built dist with no condition. Exits non-zero with a message on the first failure.
 * @module @cldmv/slothlet/tests/smoke/runtime-floor
 * @package
 * @internal
 */

import assert from "node:assert/strict";
import { AsyncLocalStorage, AsyncResource, executionAsyncResource } from "node:async_hooks";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtime-floor-api");
const nodeOptions = (process.env.NODE_OPTIONS ?? "").split(/\s+/).filter(Boolean);
const flags = [...process.execArgv, ...nodeOptions];
const source = flags.some((f) => f === "--conditions=slothlet-dev" || f === "-C=slothlet-dev") || flags.includes("slothlet-dev");

/**
 * Runs one named check and prints its result.
 * @param {string} name - Check label.
 * @param {() => Promise<void> | void} fn - Check body; throws on failure.
 * @returns {Promise<void>}
 */
async function check(name, fn) {
	await fn();
	console.log(`ok - ${name}`);
}

/**
 * Builds an api from the fixture, calls its leaves and shuts it down.
 * @param {Function} slothlet - The slothlet factory under test.
 * @param {object} options - Extra slothlet options.
 * @returns {Promise<void>}
 */
async function bootAndCall(slothlet, options) {
	const api = await slothlet({ base: BASE, context: { user: "floor" }, ...options });
	try {
		assert.equal(await api.math.add(2, 3), 5, "api.math.add(2, 3)");
		assert.deepEqual(await api.report(4, 5), { sum: 9, user: "floor" }, "api.report(4, 5)");
	} finally {
		await api.slothlet.shutdown();
	}
}

/**
 * Deep-searches a value for a marker object, following own keys (symbols included) and Map entries.
 * @param {unknown} value - Value to search.
 * @param {object} marker - Object to look for.
 * @param {number} [depth=0] - Current depth.
 * @param {Set<unknown>} [seen] - Already-visited values.
 * @returns {boolean} Whether the marker is reachable.
 */
function reaches(value, marker, depth = 0, seen = new Set()) {
	if (value === marker) return true;
	if (!value || (typeof value !== "object" && typeof value !== "function") || depth > 4 || seen.has(value)) return false;
	seen.add(value);
	if (value instanceof Map) {
		for (const [k, v] of value) if (reaches(k, marker, depth + 1, seen) || reaches(v, marker, depth + 1, seen)) return true;
	}
	for (const key of Reflect.ownKeys(value)) {
		let v;
		try {
			v = value[key];
		} catch {
			continue;
		}
		if (reaches(v, marker, depth + 1, seen)) return true;
	}
	return false;
}

/**
 * AsyncContextFrame canary. Without AsyncContextFrame, an AsyncLocalStorage store is stored on the
 * current async resource (and on promises created inside `run`), so it is reachable from
 * `executionAsyncResource()`. With AsyncContextFrame on it lives in the frame instead. The search is
 * shape-agnostic: Node 22 keys the store by `Symbol(kResourceStore)`, newer lines nest it under
 * `Symbol(kAsyncLocalStorageContext)`.
 * @returns {{ exposed: boolean, resource: boolean, promise: boolean, asyncResource: boolean }}
 */
function probeAsyncContextFrame() {
	const marker = Object.freeze({ marker: true });
	const als = new AsyncLocalStorage();
	const result = {};
	als.run(marker, () => {
		result.resource = reaches(executionAsyncResource(), marker);
		result.promise = reaches(Promise.resolve(), marker);
		result.asyncResource = reaches(new AsyncResource("runtime-floor-probe"), marker);
	});
	return { exposed: result.resource || result.promise, ...result };
}

/**
 * Whether this process runs with AsyncContextFrame on: opt-in by flag before Node 24, default from 24.
 * @returns {boolean}
 */
function asyncContextFrameEnabled() {
	const major = Number(process.versions.node.split(".")[0]);
	if (flags.includes("--no-async-context-frame")) return false;
	if (flags.includes("--experimental-async-context-frame")) return true;
	return major >= 24;
}

try {
	console.log(`runtime-floor smoke: Node ${process.version}, ${source ? "src (slothlet-dev)" : "dist"}`);

	const esm = await import("@cldmv/slothlet");
	const slothlet = esm.default;

	await check("ESM entry exports the factory", () => {
		assert.equal(typeof slothlet, "function", "default export");
		assert.equal(esm.slothlet, slothlet, "named slothlet export matches the default");
	});

	await check("eager api builds and its leaves answer", () => bootAndCall(slothlet, { mode: "eager" }));
	await check("lazy api builds and its leaves answer", () => bootAndCall(slothlet, { mode: "lazy" }));

	await check("CJS entry loads through require()", async () => {
		const require = createRequire(import.meta.url);
		const cjs = require("@cldmv/slothlet");
		assert.equal(cjs, slothlet, "require() returns the ESM entry's factory");
		await bootAndCall(cjs, { mode: "eager" });
	});

	await check("@cldmv/slothlet/runtime imports", async () => {
		const runtime = await import("@cldmv/slothlet/runtime");
		assert.ok(runtime.self, "runtime exports self");
		assert.ok(runtime.context, "runtime exports context");
	});

	await check('boots with permissions { mode: "on" }', () => bootAndCall(slothlet, { mode: "eager", permissions: { mode: "on" } }));

	await check("AsyncContextFrame canary", () => {
		const probe = probeAsyncContextFrame();
		const enabled = asyncContextFrameEnabled();
		console.log(`   AsyncContextFrame ${enabled ? "on" : "off"}, probe ${JSON.stringify(probe)}`);
		assert.equal(
			probe.exposed,
			!enabled,
			`store should be ${enabled ? "hidden" : "exposed"} with AsyncContextFrame ${enabled ? "on" : "off"}`
		);
	});

	console.log("runtime-floor smoke: all checks passed");
} catch (error) {
	console.error(`runtime-floor smoke FAILED on Node ${process.version} (${source ? "src" : "dist"}): ${error?.message ?? error}`);
	console.error(error);
	process.exit(1);
}
