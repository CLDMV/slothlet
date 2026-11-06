/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-vite.test.vitest.mjs
 *	@Date: 2026-11-05T20:15:48-08:00 (1793938548)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T21:30:02-08:00 (1793943002)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's own files, transformed by vite under vitest, run inside a module's call as that call (#714).
 * @description
 * Under vitest a host's own files (rummage's `src/ext-host/*.mjs`, a test file, the helpers it imports) are transformed
 * by vite and evaluated by vitest's module runner, so their code never hashes as the file on disk does. The
 * `slothletInstanceImports()` vite plugin appends a registration to each of them, which slothlet accepts only when
 * vitest's (or vite's) own runner evaluated the file. The code of the package that created the instance then runs as
 * the module's call it is in, giving what it gives under Node's own loader (`permissions-host-owner-code`): lazy and
 * eager alike, in both runtimes.
 *
 * A vite-transformed file of a folder with a `package.json` of its own, which the test imports, runs as the module's
 * call as well, as such a file the host imports does under Node's own loader. Two things stay refused: the same
 * closures compiled with `vm` under the host file's name, and the same with a registration made from that compiled code
 * instead of from vitest's runner.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";
import { makeContext } from "../../../../api_tests/api_test_host_owner_code/host/context.mjs";
import { makeContext as importingContext } from "../../../../api_tests/api_test_host_owner_code/host/imported.mjs";
import { makeContext as otherPackageContext } from "../../../../api_tests/api_test_host_owner_code/other-pkg/context.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_host_owner_code");
const CONTEXT_FILE = path.join(FIXTURE, "host", "context.mjs");
const PERMISSIONS = { defaultPolicy: "deny", rules: [{ caller: "ext.**", target: "host.**", effect: "allow" }] };
const CALLS = ["pin", "meta", "emit", "hostLeaf"];

/** What each call gives when the host's code runs as the module's call (the plain-Node owner case's answers). */
const HOST_ANSWERS = {
	pin: { ok: true, value: "function" },
	meta: { ok: true, value: null },
	emit: { ok: true, value: "emitted" },
	hostLeaf: { ok: true, value: "echo:x" }
};

/** What each call gives when the code doing it is no one's. */
const REFUSED = Object.fromEntries(CALLS.map((call) => [call, { ok: false, code: "PERMISSION_DENIED", caller: null }]));

/** The context's closures as source, compiled again below under the host file's name. */
const CONTEXT_SOURCE =
	"(api) => ({ pin: (fn) => typeof api.slothlet.lockCaller(fn), meta: () => api.slothlet.metadata.caller()?.apiPath ?? null, " +
	"emit: () => (api.slothlet.event.emit('host:ping', { n: 1 }), 'emitted'), hostLeaf: () => api.host.echo('x') })";

/** The registration the plugin appends, made by the compiled code itself rather than by vitest's runner. */
const REGISTRATION = '(globalThis[Symbol.for("@cldmv/slothlet.viteHostScripts")] ??= []).push(new Error());';

describe.each(getMatrixConfigs())(
	"Permissions > the host's own vite-transformed files, inside a module's call (#714) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown();
			api = null;
		});

		/**
		 * Create the instance from this (vite-transformed) file and mount the host's own leaf.
		 * @returns {Promise<object>} The api.
		 */
		const boot = async () => {
			api = await slothlet({ ...config, base: path.join(FIXTURE, "api"), silent: true, permissions: PERMISSIONS });
			await api.slothlet.api.add("host", { echo: (value) => `echo:${value}` }, { moduleID: "host-mod" });
			return api;
		};

		it("runs the code of a file of the owner's package as the module's call", async () => {
			await boot();
			expect(await api.ext.a.activate(makeContext(api))).toEqual(HOST_ANSWERS);
		});

		it("runs the code of a file of the owner's package that imports another as the module's call", async () => {
			await boot();
			expect(await api.ext.a.activate(importingContext(api))).toEqual(HOST_ANSWERS);
		});

		it("refuses the closures compiled with vm under the host file's name", async () => {
			await boot();
			const forged = vm.runInThisContext(CONTEXT_SOURCE, { filename: CONTEXT_FILE });
			expect(await api.ext.a.activate(forged(api))).toEqual(REFUSED);
		});

		it("refuses them when the compiled code registers itself instead of vitest's runner", async () => {
			await boot();
			const forged = vm.runInThisContext(`${REGISTRATION}\n${CONTEXT_SOURCE}`, { filename: CONTEXT_FILE });
			expect(await api.ext.a.activate(forged(api))).toEqual(REFUSED);
		});

		it("runs a vite-transformed file of a package the host imported as the module's call, as under Node's own loader", async () => {
			await boot();
			expect(await api.ext.a.activate(otherPackageContext(api))).toEqual(HOST_ANSWERS);
		});
	}
);

describe("slothletInstanceImports() > the host-file registration it appends (#714)", () => {
	const plugin = slothletInstanceImports();
	const transform = (code, id) => plugin.transform.handler.call({}, code, id);
	const ROOT = path.resolve(FIXTURE, "../..").replaceAll("\\", "/");

	it("appends the registration to a host's own file, after its code", async () => {
		const out = await transform("export const x = 1;", CONTEXT_FILE.replaceAll("\\", "/"));
		expect(out.code.startsWith("export const x = 1;\n")).toBe(true);
		expect(out.code).toContain(REGISTRATION);
	});

	it.each([
		["a package under node_modules", `${FIXTURE.replaceAll("\\", "/")}/node_modules/owner-host/context.mjs`],
		["slothlet's own source", `${ROOT}/src/lib/handlers/frame-placement.mjs`],
		["slothlet's package entry", `${ROOT}/index.mjs`],
		["a file that is not JavaScript", `${FIXTURE.replaceAll("\\", "/")}/host/style.css`],
		["a virtual module", "\0virtual:thing"],
		["a CommonJS file", `${FIXTURE.replaceAll("\\", "/")}/host/legacy.cjs`],
		["a .js file of a CommonJS package", `${ROOT}/api_tests/api_test_cjs_js/commonjs/counter/counter.js`]
	])("leaves %s as it is", async (_kind, id) => {
		expect(await transform("export const x = 1;", id)).toBeNull();
	});
});
