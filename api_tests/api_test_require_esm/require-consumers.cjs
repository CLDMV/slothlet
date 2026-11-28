/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_require_esm/require-consumers.cjs
 *	@Date: 2026-11-27T21:56:48-08:00 (1795845408)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:25-08:00 (1795868965)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Loads each consumer entry and each public entry point with `require()`, and builds an api through the
 * CommonJS entry, printing one
 * JSON line of results (#1034). Run as a child process by `require-esm-entries.test.vitest.mjs`.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const results = {};
const consumers = path.join(__dirname, "consumers");
for (const file of fs.readdirSync(consumers).sort()) {
	try {
		const mod = require(path.join(consumers, file));
		results[file] = { ok: true, names: mod.names.length };
	} catch (error) {
		results[file] = { ok: false, code: error?.code ?? String(error) };
	}
}

// Each public entry point required directly, which its `default` export condition allows (#1034).
for (const spec of [
	"@cldmv/slothlet",
	"@cldmv/slothlet/runtime",
	"@cldmv/slothlet/runtime/async",
	"@cldmv/slothlet/runtime/live",
	"@cldmv/slothlet/errors",
	"@cldmv/slothlet/i18n",
	"@cldmv/slothlet/files",
	"@cldmv/slothlet/sanitize",
	"@cldmv/slothlet/typegen",
	"@cldmv/slothlet/vite"
]) {
	try {
		const mod = require(spec);
		results[spec] = { ok: true, names: Object.keys(mod).length };
	} catch (error) {
		results[spec] = { ok: false, code: error?.code ?? String(error) };
	}
}

const slothlet = require("@cldmv/slothlet");
slothlet({ base: path.join(__dirname, "api") })
	.then(async (api) => {
		results.api = { ok: true, sum: await api.math.add(2, 3), self: await api.math.selfReachesMe() };
		await api.shutdown();
	})
	.catch((error) => {
		results.api = { ok: false, code: error?.code ?? String(error) };
	})
	.finally(() => {
		process.stdout.write(`${JSON.stringify(results)}\n`);
	});
