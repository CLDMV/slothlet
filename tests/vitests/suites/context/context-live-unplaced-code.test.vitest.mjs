/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-unplaced-code.test.vitest.mjs
 *	@Date: 2026-10-16T20:03:05-07:00 (1792206185)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T20:04:50-07:00 (1792206290)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live runtime: a suspended module call is attributed to its module wherever its code
 * lives — under a symlinked base, or in a file outside the module's folder — and never to the host
 * (#601 review).
 *
 * The live runtime tells a resumed module call from host code by the stack. It used to match frames
 * only against the paths slothlet scanned, so a call whose code ran from a path the scan never saw
 * (Node reports a symlinked file by its real path; a leaf can re-export a function from another
 * folder) matched nothing and was taken for the host, which the rules exempt. Every file slothlet
 * loads for an instance carries that instance's import tag, and host code never does, so such code
 * is now recognised as the module's.
 */

import path from "node:path";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-unplaced-code");
const REAL = path.join(ROOT, "real");
const LINK = path.join(ROOT, "link");

const RULES = {
	defaultPolicy: "allow",
	rules: ["x", "y", "z", "w"].map((module) => ({ caller: `${module}.**`, target: "c.**", effect: "deny" }))
};

// A module the rules deny, for the cases where it tries to act as a module they allow.
const ROGUE_RULES = {
	defaultPolicy: "allow",
	rules: [{ caller: "rogue.**", target: "c.**", effect: "deny" }]
};

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the real root.
 * @param {string} code - File contents.
 * @returns {void}
 */
function write(file, code) {
	const target = path.join(REAL, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, code);
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	// An ESM leaf, a CommonJS leaf and a leaf whose code lives outside the api folder, each of which
	// awaits a gate the test holds and then calls the guarded module.
	write("api/x/x.mjs", "export async function useGiven(c, gate) {\n\tawait gate;\n\treturn c.probe();\n}\n");
	write("api/z/z.cjs", "exports.useGiven = async function useGiven(c, gate) {\n\tawait gate;\n\treturn c.probe();\n};\n");
	write("api/y/y.mjs", 'export { useGiven } from "../../shared/impl.mjs";\n');
	write("shared/impl.mjs", "export async function useGiven(c, gate) {\n\tawait gate;\n\treturn c.probe();\n}\n");
	write("api/c/c.mjs", 'export function probe() {\n\treturn "reached";\n}\n');
	// A leaf re-exporting from a package: a bare specifier, so the file carries no instance tag and lies
	// in no module's folder. Only the function the suspended call entered names it on the stack.
	write("api/w/w.mjs", 'export { useGiven } from "unplaced-helper";\n');
	write("node_modules/unplaced-helper/package.json", '{ "name": "unplaced-helper", "type": "module", "exports": "./index.mjs" }\n');
	write("node_modules/unplaced-helper/index.mjs", "export async function useGiven(c, gate) {\n\tawait gate;\n\treturn c.probe();\n}\n");
	// A module the rules allow, whose call stays suspended, and one they deny, which tries to act as it.
	write("api/admin/admin.mjs", 'export async function hold(gate) {\n\tawait gate;\n\treturn "held";\n}\n');
	write(
		"api/rogue/rogue.mjs",
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			'import { stat } from "node:fs";',
			"// Resumed after an await, it runs code that has no file of its own and is named after admin's entry.",
			"export async function named(gate) {",
			"\tawait gate;",
			'\treturn new Function("self", "return (function hold() { return self.c.probe(); })();\\n//# sourceURL=/nowhere/pkg/index.js")(self);',
			"}",
			"// It returns at once and, from a callback slothlet does not patch, calls the guarded module after its own",
			"// call has ended, while admin's call is suspended.",
			"export function viaUnpatched(done) {",
			'\tstat(".", () => {',
			"\t\ttry {",
			"\t\t\tdone(self.c.probe());",
			"\t\t} catch (error) {",
			"\t\t\tdone(error.code ?? error.message);",
			"\t\t}",
			"\t});",
			"}",
			""
		].join("\n")
	);
	symlinkSync(REAL, LINK, "dir");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each([{ mode: "eager" }, { mode: "lazy" }])(
	"Live runtime: code a suspended module call runs from an unscanned path ($mode)",
	({ mode }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown();
			api = null;
		});

		/**
		 * Call a module's `useGiven` with the guarded module, letting it suspend before it calls through.
		 * @param {string} base - Base folder.
		 * @param {string} module - The calling module.
		 * @returns {Promise<string>} What the call gave, or the error code it threw.
		 */
		async function callThrough(base, module) {
			api = await slothlet({ base, mode, runtime: "live", silent: true, permissions: RULES });
			await api[module];
			await api.c;
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const pending = api[module].useGiven(api.c, gate);
			release();
			try {
				return await pending;
			} catch (error) {
				return error.code ?? error.message;
			}
		}

		it.each([
			["an ES module leaf under a symlinked base", LINK, "x"],
			["a CommonJS leaf under a symlinked base", LINK, "z"],
			["a leaf re-exporting code from outside its folder", REAL, "y"],
			["a leaf re-exporting code from outside its folder, under a symlinked base", LINK, "y"],
			["a leaf re-exporting code from a package, which carries no instance tag", REAL, "w"],
			["an ES module leaf on its real path", REAL, "x"]
		])("%s is refused as its module, not let through as the host", async (_label, root, module) => {
			expect(await callThrough(path.join(root, "api"), module)).toBe("PERMISSION_DENIED");
		});

		it("a function named after another module's suspended entry does not borrow that module's identity", async () => {
			api = await slothlet({ base: path.join(REAL, "api"), mode, runtime: "live", silent: true, permissions: ROGUE_RULES });
			await api.admin;
			await api.rogue;
			await api.c;
			let releaseAdmin;
			const adminGate = new Promise((resolve) => (releaseAdmin = resolve));
			const admin = api.admin.hold(adminGate);
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const pending = api.rogue.named(gate);
			release();
			expect(await pending.catch((error) => error.code)).toBe("PERMISSION_DENIED");
			releaseAdmin();
			expect(await admin).toBe("held");
		});

		it("a callback from a boundary slothlet does not patch is refused, not run as another module whose call is suspended", async () => {
			api = await slothlet({ base: path.join(REAL, "api"), mode, runtime: "live", silent: true, permissions: ROGUE_RULES });
			await api.admin;
			await api.rogue;
			await api.c;
			let releaseAdmin;
			const adminGate = new Promise((resolve) => (releaseAdmin = resolve));
			const admin = api.admin.hold(adminGate);
			await new Promise((resolve) => setTimeout(resolve, 0));
			const outcome = await new Promise((resolve) => api.rogue.viaUnpatched(resolve));
			expect(outcome).not.toBe("reached");
			releaseAdmin();
			expect(await admin).toBe("held");
		});

		it("host code running while a module call is suspended is still the host's", async () => {
			api = await slothlet({ base: path.join(LINK, "api"), mode, runtime: "live", silent: true, permissions: RULES });
			await api.x;
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const pending = api.x.useGiven(api.c, gate);
			await Promise.resolve();
			// The host's own call, made while x's call is suspended: no rule names the host.
			expect(await api.c.probe()).toBe("reached");
			release();
			expect(await pending.catch((error) => error.code)).toBe("PERMISSION_DENIED");
		});
	}
);
