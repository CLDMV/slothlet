/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/probe.mjs
 *	@Date: 2026-11-05T16:50:21-08:00 (1793926221)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T17:39:42-08:00 (1794015582)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Boots the #714 fixture the way an installed host does in production: the host package and a stranger
 * package are loaded before slothlet, slothlet is imported afterwards, and the host package creates the instance. Each
 * context is handed to the module's `activate`, and what every call gave is printed as JSON, for every mode and
 * runtime. Run with `--replace-builtins`, it first replaces the built-ins slothlet's attribution reads, after slothlet's
 * runtime loaded (see `replace-builtins.mjs`), so each answer can be compared with the one given without.
 * @module api_test_host_owner_code.probe
 */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { boot } from "owner-host";
import { makeContext as strangerContext } from "stranger-pkg";

const here = path.dirname(fileURLToPath(import.meta.url));
const ownerContextFile = createRequire(import.meta.url)
	.resolve("owner-host")
	.replace(/index\.mjs$/, "context.mjs");
const { default: slothlet } = await import("@cldmv/slothlet");

/** The owner's `makeContext` as source that is not the file's. */
const forgedSource =
	"(api) => ({ pin: (fn) => typeof api.slothlet.lockCaller(fn), meta: () => api.slothlet.metadata.caller()?.apiPath ?? null, " +
	"emit: () => (api.slothlet.event.emit('host:ping', { n: 1 }), 'emitted'), hostLeaf: () => api.host.echo('x') })";

if (process.argv.includes("--replace-builtins")) {
	// Slothlet's runtime loads on the first `slothlet()` call; it is loaded here first, so the replacements come after it.
	await import("@cldmv/slothlet/slothlet");
	const { replaceBuiltins } = await import("./replace-builtins.mjs");
	replaceBuiltins({ file: ownerContextFile, source: forgedSource });
}

/**
 * The owner's `makeContext` compiled again under the owner file's name, from source that is not the file's.
 * @type {(api: object) => Record<string, Function>}
 */
const forgedContext = vm.runInThisContext(forgedSource, { filename: ownerContextFile });

const out = { ownerFileExists: fs.existsSync(ownerContextFile) };
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) {
		const { api, ctx } = await boot(slothlet, {
			base: path.join(here, "api"),
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "ext.**", target: "host.**", effect: "allow" }] }
		});
		out[`${mode}/${runtime}/owner`] = await api.ext.a.activate(ctx);
		out[`${mode}/${runtime}/stranger`] = await api.ext.a.activate(strangerContext(api));
		out[`${mode}/${runtime}/forged`] = await api.ext.a.activate(forgedContext(api));
		await api.slothlet.shutdown();
	}
console.log(JSON.stringify(out));
