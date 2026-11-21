/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_node_named_compile/run.mjs
 *	@Date: 2026-11-17T08:00:00-08:00 (1794931200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:15:14-08:00 (1794932114)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `permissions-plain-node-named-compile` in a plain Node process (no vitest): while a module file
 * loads, another module's leaf whose rules open `capability:code` compiles code under the loading file's tagged name,
 * twice, and the outcome of each config is printed as one JSON line.
 * @module api_test_plain_node_named_compile.run
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "api");
const GATE = Symbol.for("slothlet.test.plainNamedCompile");

/**
 * Run one try.
 * @param {function(): *} run - The try.
 * @returns {Promise<string>} "done", or the code of what was thrown.
 */
async function attempt(run) {
	try {
		await run();
		return "done";
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) {
		let api = null;
		try {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: { rules: [{ caller: "other.compile", target: "capability:code", effect: "allow" }] }
			});
			let release;
			let loading;
			const gate = { name: null, done: new Promise((resolve) => (release = resolve)) };
			const started = new Promise((resolve) => (loading = resolve));
			gate.loading = loading;
			globalThis[GATE] = gate;
			const added = (async () => {
				await api.slothlet.api.add(["again"], path.join(BASE, "late"));
				return api.again.probe.loaded();
			})();
			await started;
			const result = { tagged: /[?&]slothlet_instance=/.test(String(gate.name)) };
			result.first = await attempt(() => api.other.compile("globalThis.__slothletPlainNamedCompile = 1", gate.name));
			result.second = await attempt(() => api.other.compile("globalThis.__slothletPlainNamedCompile = 2", gate.name));
			result.unnamed = await attempt(() => api.other.compile("1 + 1"));
			release();
			result.loaded = await added;
			result.ran = globalThis.__slothletPlainNamedCompile ?? null;
			out[`${mode}/${runtime}`] = result;
		} catch (error) {
			out[`${mode}/${runtime}`] = { error: error?.code ?? String(error?.message ?? error) };
		} finally {
			delete globalThis[GATE];
			delete globalThis.__slothletPlainNamedCompile;
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		}
	}
process.stdout.write(`PLAIN-NAMED-COMPILE ${JSON.stringify(out)}\n`);
