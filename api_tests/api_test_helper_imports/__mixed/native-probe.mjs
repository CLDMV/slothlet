/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/native-probe.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:34-07:00 (1791090874)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Native-Node probe for #534: composes the mixed-format fixture OUTSIDE any vite module
 * graph, so ESM→CommonJS imports and CommonJS→ESM `require()` calls go through Node's own loaders and
 * slothlet's module hooks. Prints one JSON line of observed counters for the test to assert on.
 * @module api_test_helper_imports.mixed.nativeProbe
 * @internal
 */
import slothlet from "@cldmv/slothlet";

const base = new URL("./api/", import.meta.url).pathname;
const out = {};

for (const mode of ["eager", "lazy"]) {
	const r = {};
	const a = await slothlet({ mode, base, silent: true });
	const b = await slothlet({ mode, base, silent: true });
	// ESM leaf → .cjs helper: named import (a, a, b), then the default import (module.exports) for a and b.
	r.esmToCjs = [
		await a.esmcjs.count(),
		await a.esmcjs.count(),
		await b.esmcjs.count(),
		await a.esmcjs.viaDefault(),
		await b.esmcjs.viaDefault()
	];
	// Below the .cjs helper: its CommonJS require (a, a, b) and its require() of an ES module (a, a, b).
	r.esmToCjsChain = [
		await a.esmcjs.inner(),
		await a.esmcjs.inner(),
		await b.esmcjs.inner(),
		await a.esmcjs.deep(),
		await a.esmcjs.deep(),
		await b.esmcjs.deep()
	];
	r.esmToCjsObject = [await a.esmcjs.object(), await a.esmcjs.object(), await b.esmcjs.object()];
	r.esmToCjsShape = await a.esmcjs.shape();
	r.esmToCjsPeer = [await a.esmcjspeer.count(), await b.esmcjspeer.count()];
	// .cjs leaf → .mjs helper (a, a, b), its own import chain (a, b), and a `.js` ES module (a, a, b).
	r.cjsToEsm = [
		await a.cjsesm.count(),
		await a.cjsesm.count(),
		await b.cjsesm.count(),
		await a.cjsesm.chain(),
		await b.cjsesm.chain(),
		await a.cjsesm.plain(),
		await a.cjsesm.plain(),
		await b.cjsesm.plain()
	];
	r.cjsToEsmInterop = await a.cjsesm.interop();
	// One copy per instance across module systems: an ESM leaf importing the .mjs helper the .cjs leaf
	// requires, and the .cjs leaf requiring the .cjs helper the ESM leaves import.
	r.crossFormat = [await a.esmpeer.count(), await b.esmpeer.count(), await a.cjsesm.cjs(), await b.cjsesm.cjs()];
	await a.slothlet.reload();
	r.afterFullReload = [
		await a.esmcjs.count(),
		await a.esmcjs.deep(),
		await a.cjsesm.count(),
		await a.cjsesm.chain(),
		await a.cjsesm.plain(),
		await b.esmcjs.count()
	];
	await b.slothlet.api.reload("esmcjs");
	await b.slothlet.api.reload("cjsesm");
	r.afterPartialReload = [
		await b.esmcjs.count(),
		await b.esmcjs.deep(),
		await b.cjsesm.count(),
		await b.cjsesm.plain(),
		await a.esmcjs.count()
	];
	await a.shutdown();
	await b.shutdown();
	out[mode] = r;
}

process.stdout.write(JSON.stringify(out) + "\n");
