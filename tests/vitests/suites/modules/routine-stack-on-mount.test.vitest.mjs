/**
 * @fileoverview A module mounted via api.modules.addModule()/addModules() must get its configured
 * routines' stacked callables installed (#362).
 *
 * @description
 * The single/multi module-mount paths (ModuleManager.addModule / addModules) compose a component
 * onto the live tree just like api.slothlet.api.add() does, but historically never called
 * rebuildStacks() afterward — so a routine matching a leaf of a module mounted this way never got
 * its stacked callable installed. The reactive self-heal (#362) cannot cover it either: it no-ops
 * during a build (which these mounts are), and a mount-relative routine name can't match until the
 * module's ownership endpoint is registered, which happens during that same build. These tests pin
 * that both mount methods install the stack (and it actually invokes the mounted contributor).
 *
 * @module tests/vitests/suites/modules/routine-stack-on-mount
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_ROUTINE_MODULE = path.join(FIXTURE_ROOT, "api_test_routines_module");

/** @type {any} */
let api;

afterEach(async () => {
	if (api?.shutdown) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

describe("routine stacks are installed for modules mounted via addModule()/addModules() (#362)", () => {
	it("addModule() installs the configured routine's stacked callable at the mounted leaf, and it invokes the contributor", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			routines: [{ name: "^ext.widget.initialize", mode: "manual" }],
			api: { collision: { initial: "merge", api: "merge" } }
		});

		const res = await api.slothlet.api.modules.addModule("@local/routine-widget", { discover: { scanRoot: FIX_ROUTINE_MODULE } });
		expect(res.mountPath).toBe("ext.widget");

		// The mount path must have installed the routine's stacked callable (fails pre-#362-Fix-B:
		// the leaf stays the bare mounted function, __slothletRoutineStack undefined).
		expect(api.ext.widget.initialize.__slothletRoutineStack).toBe(true);
		expect(api.ext.widget.initialize.__slothletRoutineName).toBe("^ext.widget.initialize");

		// And it actually runs the mounted module's contributor, forwarding args.
		globalThis.__slothletRoutineModuleLog = [];
		const out = await api.ext.widget.initialize("alpha", 7);
		expect(out).toBe("routine-widget:initialize");
		expect(globalThis.__slothletRoutineModuleLog).toEqual([{ from: "routine-widget", args: ["alpha", 7] }]);
	});

	it("addModules() installs the stacked callable the same way", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			routines: [{ name: "^ext.widget.initialize", mode: "manual" }],
			api: { collision: { initial: "merge", api: "merge" } }
		});

		const found = await api.slothlet.api.modules.discover({ scanRoot: FIX_ROUTINE_MODULE });
		await api.slothlet.api.modules.addModules(found);

		expect(api.ext.widget.initialize.__slothletRoutineStack).toBe(true);

		globalThis.__slothletRoutineModuleLog = [];
		const out = await api.ext.widget.initialize("beta");
		expect(out).toBe("routine-widget:initialize");
		expect(globalThis.__slothletRoutineModuleLog).toEqual([{ from: "routine-widget", args: ["beta"] }]);
	});
});
