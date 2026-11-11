/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-vite.test.vitest.mjs
 *	@Date: 2026-11-05T20:15:48-08:00 (1793938548)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T17:47:03-08:00 (1794016023)
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
 * Only code the runner itself evaluated is accepted as a file's own source: the records vitest's runner made before
 * slothlet loaded (read once then, never again), and the registration the plugin appends (verified by its unread error
 * stack and the runner frame below it). A file the host imported runs as the module's call, as under Node's own loader.
 * Three things are refused: the same closures compiled with `vm` under the host file's name; the same with a
 * registration the compiled code makes itself rather than the runner; and a record added to the runner's module map
 * after slothlet loaded.
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

/** The six vite SSR bindings each module the runner evaluates is wrapped as a function of. */
const RUNNER_SSR =
	"__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__";

/**
 * A context whose closures a module compiled under the owner context file's name, after planting a record for that
 * file in vitest's own module map so its code would hash as the file's source. Only code the runner itself evaluated
 * is accepted, so the plant vouches for nothing and the closures are refused.
 * @param {object} api - The bound api the test's own `slothlet()` call returned.
 * @returns {Record<string, Function>} The planted context.
 */
function plantedRecordContext(api) {
	const inner = `__vite_ssr_exports__.make = ${CONTEXT_SOURCE};
`;
	const wrapped = `'use strict';async (${RUNNER_SSR})=>{{${inner}
}}`;
	const worker = globalThis.__vitest_worker__;
	const map = worker?.evaluatedModules?.fileToModulesMap;
	if (map && typeof map.set === "function") {
		const records = map.get(CONTEXT_FILE) ?? new Set();
		records.add({ file: CONTEXT_FILE, meta: { code: inner }, importers: new Set() });
		map.set(CONTEXT_FILE, records);
	}
	const exports = {};
	vm.runInThisContext(wrapped, { filename: CONTEXT_FILE })(
		exports,
		{},
		() => {},
		() => {},
		() => {},
		() => {}
	);
	return exports.make(api);
}

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

		it("runs a vite-transformed file of a package the host imported as the module's call, its record taken from before slothlet loaded", async () => {
			await boot();
			// docs/PERMISSIONS.md "Where the source cannot be checked": a record vitest's runner made before slothlet loaded is
			// taken as the file's source, so a file only the host loaded runs as the module's call, as under Node's own loader.
			expect(await api.ext.a.activate(otherPackageContext(api))).toEqual(HOST_ANSWERS);
		});

		it("refuses a record a module plants in the runner's module map under an owner file's name", async () => {
			await boot();
			expect(await api.ext.a.activate(plantedRecordContext(api))).toEqual(REFUSED);
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
