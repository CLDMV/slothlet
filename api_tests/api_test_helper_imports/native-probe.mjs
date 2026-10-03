/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/native-probe.mjs
 *	@Date: 2026-09-28 20:35:50 -07:00 (1790652950)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 20:49:50 -07:00 (1790653790)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Native-Node probe for #518: composes the helper-imports fixture OUTSIDE any vite
 * module graph, so the leaves and their helpers load through Node's own resolver and slothlet's
 * resolve hook. Prints one JSON line of observed counters for the test to assert on.
 * @module api_test_helper_imports.nativeProbe
 * @internal
 */
import slothlet from "@cldmv/slothlet";
import * as nodeModule from "node:module";

const base = new URL("./api/", import.meta.url).pathname;
const mount = new URL("./mount/", import.meta.url).pathname;
const out = { hookApi: typeof nodeModule.registerHooks === "function" ? "registerHooks" : "register" };

for (const mode of ["eager", "lazy"]) {
	const r = {};
	const a = await slothlet({ mode, base, typescript: true, silent: true });
	const b = await slothlet({ mode, base, typescript: true, silent: true });
	r.esm = [await a.tally.count(), await a.tally.count(), await b.tally.count()];
	r.chain = [await a.tally.chain(), await a.tally.chain(), await b.tally.chain()];
	r.nested = [await a.tally.nested(), await b.tally.nested()];
	r.peer = [await a.peer.count(), await b.peer.count()];
	r.cjs = [await a.cjsleaf.count(), await a.cjspeer.count(), await b.cjsleaf.count(), await a.cjsleaf.inner(), await b.cjsleaf.inner()];
	r.ts = [await a.tsleaf.tsCount(), await a.tsleaf.tsCount(), await b.tsleaf.tsCount(), await a.tsleaf.count(), await b.tsleaf.count()];
	const refsA = await a.shared.refs();
	const refsB = await b.shared.refs();
	r.sharedRefs = refsA.runtime === refsB.runtime && refsA.EventEmitter === refsB.EventEmitter && refsA.Parser === refsB.Parser;
	r.viaSelf = [await a.shared.viaSelf(), await b.shared.viaSelf()];
	// An api.add mount shares the base leaves' helper copy within each instance.
	await a.slothlet.api.add("plugins", mount);
	await b.slothlet.api.add("plugins", mount);
	r.mount = [
		await a.plugins.extra.count(),
		await b.plugins.extra.count(),
		await a.plugins.cjsextra.count(),
		await b.plugins.cjsextra.count()
	];
	await a.slothlet.reload();
	r.afterFullReload = [
		await a.tally.count(),
		await a.tally.chain(),
		await a.cjsleaf.count(),
		await a.tsleaf.tsCount(),
		await b.tally.count()
	];
	await b.slothlet.api.reload("tally");
	r.afterScopedReload = [await b.tally.count(), await b.tally.chain(), await a.tally.count()];
	await b.slothlet.api.reload("plugins");
	r.afterMountReload = [await b.plugins.extra.count(), await b.tally.count(), await b.plugins.cjsextra.count(), await b.cjsleaf.count()];
	await a.shutdown();
	await b.shutdown();
	out[mode] = r;
}

process.stdout.write(JSON.stringify(out) + "\n");
