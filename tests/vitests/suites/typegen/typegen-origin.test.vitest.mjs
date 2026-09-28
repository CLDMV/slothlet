/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/typegen-origin.test.vitest.mjs
 *	@Date: 2026-09-28 00:19:50 -07:00 (1790579990)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 00:53:46 -07:00 (1790582026)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Typegen types the api slothlet actually composes (#484).
 *
 * Every member of a generated declaration must reference the export slothlet placed at that path —
 * `typeof import("<leaf>")["k"]` — read from the module origin the ownership records carry, so a
 * tree mixing `.mjs`, `.cjs` and `.mts` leaves (named, default, CommonJS, flattened, callable
 * namespaces, object leaves, non-function values) is typed exactly. The acceptance checks compile a
 * probe that imports `self` from `@cldmv/slothlet/runtime` and awaits `slothlet()` against the
 * generated file, under both NodeNext and Bundler resolution with `allowJs`, asserting the positive
 * calls type-check and every `@ts-expect-error` line really is an error.
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import slothlet from "@cldmv/slothlet";
import { generateTypes } from "@cldmv/slothlet/typegen";
import { generateTypes as generateFromInstance } from "@cldmv/slothlet/processors/type-generator";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

// Each compile builds a full TypeScript program over slothlet's own declarations with lib checking on
// (the generated file is itself a .d.mts, so skipLibCheck would skip exactly what is under test).
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

const FIXTURE = path.resolve("api_tests/api_test_typegen_mixed");

const tempRoots = [];

afterAll(async () => {
	await Promise.allSettled(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
});

/**
 * Create a scratch directory inside the package (so `@cldmv/slothlet` self-resolves from it).
 * @returns {Promise<string>} Absolute directory path.
 */
async function freshTempDir() {
	const root = await makeTestTmpDir("typegen-origin");
	tempRoots.push(root);
	return root;
}

/**
 * Compile files and return every diagnostic outside `node_modules`, formatted.
 * @param {string[]} files - Root files of the program.
 * @param {"nodenext"|"bundler"} resolution - Module resolution strategy.
 * @returns {string[]} Formatted diagnostics (empty = the program type-checks).
 */
function compile(files, resolution) {
	const nodeNext = resolution === "nodenext";
	const program = ts.createProgram(files, {
		noEmit: true,
		strict: true,
		allowJs: true,
		skipLibCheck: false,
		target: ts.ScriptTarget.ES2022,
		module: nodeNext ? ts.ModuleKind.NodeNext : ts.ModuleKind.ESNext,
		moduleResolution: nodeNext ? ts.ModuleResolutionKind.NodeNext : ts.ModuleResolutionKind.Bundler,
		// Resolve @cldmv/slothlet(/runtime) to this checkout's own declarations (types/src/…).
		customConditions: ["slothlet-dev"],
		types: ["node"]
	});
	return ts
		.getPreEmitDiagnostics(program)
		.filter((d) => !d.file || !d.file.fileName.includes(`${path.sep}node_modules${path.sep}`))
		.map((d) => {
			const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
			if (!d.file || d.start === undefined) return text;
			const { line } = d.file.getLineAndCharacterOfPosition(d.start);
			return `${path.basename(d.file.fileName)}:${line + 1} ${text}`;
		});
}

/** A TypeScript probe exercising every leaf shape of the mixed fixture through `self` and `slothlet()`. */
const TS_PROBE = `import { self } from "@cldmv/slothlet/runtime";
import slothlet from "@cldmv/slothlet";
import type { EventEmitter } from "node:events";

export function useSelf() {
	const sum: number = self.math.add(1, 2);
	const repeated: string = self.math.repeat("a", 3);
	const greeting: string = self.greet("x");
	const retries: number = self.settings.LIMITS.maxRetries;
	const mode: "strict" | "lenient" = self.settings.LIMITS.mode;
	const version: string = self.settings.VERSION;
	const shouted: string = self.text.shout("x");
	const words: number = self.text.stats.words("a b");
	const even: boolean = self.parity(2);
	const level: number = self.bulb.brightness.get();
	self.bulb.brightness.set(3);
	const events: EventEmitter = self.bulb.events();
	const widget: { id: number; name: string } = self.widgets.create("w");
	const widgetCount: number = self.widgets.count();
	const logged: string = self.logger("m");
	const info: string = self.logger.info("m");
	const logLevel: number = self.logger.LEVEL;
	const step: 5 = self.tuning.TUNE_STEP;
	const gain: 2 = self.tuning.defaults.DEFAULT_GAIN;
	const cascade: Promise<unknown> = self.initialize();
	const reload: Function = self.slothlet.api.reload;

	// @ts-expect-error named export: wrong argument type
	self.math.add("1", 2);
	// @ts-expect-error missing member
	self.math.subtract(1, 2);
	// @ts-expect-error default export: wrong argument type
	self.greet(1);
	// @ts-expect-error CommonJS module.exports = function: wrong argument type
	self.parity("2");
	// @ts-expect-error CommonJS object export member: wrong argument type
	self.text.shout(1);
	// @ts-expect-error CommonJS nested object leaf: wrong argument type
	self.text.stats.words(1);
	// @ts-expect-error interface-annotated object leaf: wrong argument type
	self.bulb.brightness.set("bright");
	// @ts-expect-error frozen constant is readonly
	self.settings.LIMITS.maxRetries = 4;
	// @ts-expect-error callable namespace: wrong argument type
	self.logger(1);
	// @ts-expect-error callable namespace member: wrong argument type
	self.logger.info(2);
	// @ts-expect-error flattened self-named file: wrong argument type
	self.widgets.create(3);
	// @ts-expect-error folder-namespace primitive is its literal export type
	const wrongStep: string = self.tuning.TUNE_STEP;
	// @ts-expect-error missing namespace
	self.nope.call();

	return { sum, repeated, greeting, retries, mode, version, shouted, words, even, level, events, widget, widgetCount, logged, info, logLevel, step, gain, wrongStep, cascade, reload };
}

export async function useApi() {
	const api = await slothlet({ base: "./api" });
	const sum: number = api.math.add(1, 2);
	const even: boolean = api.parity(4);
	await api.slothlet.shutdown();
	// @ts-expect-error wrong argument type through the consumer api
	api.math.add("1", 2);
	// @ts-expect-error missing member on the consumer api
	api.nope();
	return { sum, even };
}
`;

/** The same checks from a JSDoc-checked `.mjs` leaf. */
const JS_PROBE = `// @ts-check
import { self } from "@cldmv/slothlet/runtime";

export function useSelfFromJs() {
	/** @type {number} */
	const sum = self.math.add(1, 2);
	/** @type {string} */
	const shouted = self.text.shout("x");
	/** @type {boolean} */
	const even = self.parity(2);
	// @ts-expect-error wrong argument type
	self.math.add("1", 2);
	// @ts-expect-error missing member
	self.text.whisper("x");
	return { sum, shouted, even };
}
`;

describe("typegen types the composed api from each node's module origin (#484)", () => {
	it("records each node's exportPath in the ownership records", async () => {
		const api = await slothlet({ base: FIXTURE, mode: "eager", typescript: { mode: "fast" }, silent: true });
		try {
			const ownership = resolveWrapper(api.math).slothlet.handlers.ownership;
			const origin = (apiPath) => {
				const found = ownership.getOrigin(apiPath);
				return found && { file: path.relative(FIXTURE, found.filePath).split(path.sep).join("/"), exportPath: found.exportPath };
			};
			expect(origin("math.add")).toEqual({ file: "math.mjs", exportPath: ["add"] });
			expect(origin("greet")).toEqual({ file: "greet.mjs", exportPath: ["default"] });
			expect(origin("settings.LIMITS")).toEqual({ file: "settings.mjs", exportPath: ["LIMITS"] });
			expect(origin("settings.LIMITS.maxRetries")).toEqual({ file: "settings.mjs", exportPath: ["LIMITS", "maxRetries"] });
			expect(origin("settings.VERSION")).toEqual({ file: "settings.mjs", exportPath: ["VERSION"] });
			// CommonJS: the loader exposes module.exports as `default`.
			expect(origin("text")).toEqual({ file: "text.cjs", exportPath: ["default"] });
			expect(origin("text.shout")).toEqual({ file: "text.cjs", exportPath: ["default", "shout"] });
			expect(origin("text.stats.words")).toEqual({ file: "text.cjs", exportPath: ["default", "stats", "words"] });
			expect(origin("parity")).toEqual({ file: "parity.cjs", exportPath: ["default"] });
			expect(origin("bulb.brightness")).toEqual({ file: "bulb.mts", exportPath: ["brightness"] });
			expect(origin("bulb.brightness.set")).toEqual({ file: "bulb.mts", exportPath: ["brightness", "set"] });
			// Self-named file flattened into its folder namespace.
			expect(origin("widgets.create")).toEqual({ file: "widgets/widgets.mjs", exportPath: ["create"] });
			// Callable namespace: the default function, with the named exports merged onto it.
			expect(origin("logger")).toEqual({ file: "logger.mjs", exportPath: ["default"] });
			expect(origin("logger.info")).toEqual({ file: "logger.mjs", exportPath: ["info"] });
			expect(origin("logger.LEVEL")).toEqual({ file: "logger.mjs", exportPath: ["LEVEL"] });
			// A primitive merged into a folder namespace that several files compose — it has no identity to
			// look up and the folder namespace records no per-key map, so it is located by its own file.
			expect(origin("tuning.TUNE_STEP")).toEqual({ file: "tuning/tuning.mjs", exportPath: ["TUNE_STEP"] });
			expect(origin("tuning.defaults.DEFAULT_GAIN")).toEqual({ file: "tuning/defaults.mjs", exportPath: ["DEFAULT_GAIN"] });
			// A namespace slothlet composed from several named exports is not itself an export.
			expect(origin("math").exportPath).toBeNull();
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("keeps a primitive's origin in a multi-file namespace when a reload changes its value", async () => {
		const root = await freshTempDir();
		const tuning = path.join(root, "api", "tuning");
		await mkdir(tuning, { recursive: true });
		const writeTuning = (step) =>
			writeFile(
				path.join(tuning, "tuning.mjs"),
				`export function tune(v) { return v * TUNE_STEP; }\nexport const TUNE_STEP = ${step};\n`,
				"utf8"
			);
		await writeTuning(5);
		await writeFile(path.join(tuning, "defaults.mjs"), "export const DEFAULT_GAIN = 2;\n", "utf8");

		const api = await slothlet({ base: path.join(root, "api"), mode: "eager", silent: true });
		try {
			const ownership = resolveWrapper(api.tuning).slothlet.handlers.ownership;
			expect(api.tuning.TUNE_STEP).toBe(5);
			expect(ownership.getOrigin("tuning.TUNE_STEP")?.exportPath).toEqual(["TUNE_STEP"]);

			// The primitive's value changes on disk; after the reload it must still resolve to its export.
			// A full reload rebuilds the ownership records; a scoped reload keeps them and re-indexes the file.
			await writeTuning(7);
			await api.slothlet.api.reload("tuning");
			expect(api.tuning.TUNE_STEP).toBe(7);
			expect(ownership.getOrigin("tuning.TUNE_STEP")?.exportPath).toEqual(["TUNE_STEP"]);

			await writeTuning(9);
			await api.slothlet.reload();
			expect(api.tuning.TUNE_STEP).toBe(9);
			expect(ownership.getOrigin("tuning.TUNE_STEP")?.exportPath).toEqual(["TUNE_STEP"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("emits typeof-import references to the real exports, mapping extensions and CommonJS roots", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "types", "api.d.mts");
		const { content } = await generateTypes({ dir: FIXTURE, output, interfaceName: "MixedApi" });
		const spec = (file) => JSON.stringify(path.relative(path.dirname(output), path.join(FIXTURE, file)).split(path.sep).join("/"));

		expect(content).toContain(`add: typeof import(${spec("math.mjs")})["add"];`);
		expect(content).toContain(`greet: typeof import(${spec("greet.mjs")})["default"];`);
		expect(content).toContain(`LIMITS: typeof import(${spec("settings.mjs")})["LIMITS"];`);
		// CommonJS: `import("x.cjs")` IS module.exports, so the loader's `default` segment is dropped.
		expect(content).toContain(`text: typeof import(${spec("text.cjs")});`);
		expect(content).toContain(`parity: typeof import(${spec("parity.cjs")});`);
		// .mts leaves are imported by their runtime extension.
		expect(content).toContain(`brightness: typeof import(${spec("bulb.mjs")})["brightness"];`);
		expect(content).not.toContain("bulb.mts");
		// Callable namespace: the default function intersected with the members merged onto it.
		expect(content).toContain(`logger: typeof import(${spec("logger.mjs")})["default"] & {`);
		expect(content).toContain(`info: typeof import(${spec("logger.mjs")})["info"];`);
		expect(content).toContain(`create: typeof import(${spec("widgets/widgets.mjs")})["create"];`);
		expect(content).toContain(`TUNE_STEP: typeof import(${spec("tuning/tuning.mjs")})["TUNE_STEP"];`);
		expect(content).not.toContain("unknown;");
		// Nothing falls back to an untyped signature.
		expect(content).not.toMatch(/\bany\b/);
		expect(content).toContain('import type { SlothletAPI } from "@cldmv/slothlet";');
		expect(content).toContain("interface SlothletSelf extends MixedApi {}");
		expect(content).toContain("interface SlothletSelf extends SlothletAPI {}");
	});

	for (const resolution of ["nodenext", "bundler"]) {
		it(`types self and the slothlet() result under ${resolution} resolution`, async () => {
			const tmp = await freshTempDir();
			const output = path.join(tmp, "types", "api.d.mts");
			await generateTypes({ dir: FIXTURE, output, interfaceName: "MixedApi" });
			const tsProbe = path.join(tmp, "probe.mts");
			const jsProbe = path.join(tmp, "probe.mjs");
			await writeFile(tsProbe, TS_PROBE, "utf8");
			await writeFile(jsProbe, JS_PROBE, "utf8");

			expect(compile([output, tsProbe, jsProbe], resolution)).toEqual([]);
			// Control: without the generated declaration `self` is the bare anchor, so the same probe fails —
			// the zero above is the declaration's doing, not an `any` letting everything through.
			expect(compile([tsProbe], resolution).length).toBeGreaterThan(0);
		});
	}

	it("types a folder mounted at runtime with api.slothlet.api.add()", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "mounted.d.mts");
		const api = await slothlet({
			base: path.join(FIXTURE, "widgets"),
			mode: "eager",
			typescript: { mode: "fast" },
			silent: true
		});
		try {
			await api.slothlet.api.add("plugins.mixed", FIXTURE);
			const { output: content } = await generateFromInstance(api, { output, interfaceName: "MountedApi" });
			const spec = (file) => JSON.stringify(path.relative(tmp, path.join(FIXTURE, file)).split(path.sep).join("/"));
			expect(content).toContain(`add: typeof import(${spec("math.mjs")})["add"];`);
			expect(content).toContain(`parity: typeof import(${spec("parity.cjs")});`);

			const probe = path.join(tmp, "mounted-probe.mts");
			await writeFile(
				probe,
				[
					'import { self } from "@cldmv/slothlet/runtime";',
					"export const sum: number = self.plugins.mixed.math.add(1, 2);",
					"export const even: boolean = self.plugins.mixed.parity(2);",
					"export const created: { id: number; name: string } = self.widgets.create('w');",
					"// @ts-expect-error mounted leaf: wrong argument type",
					'self.plugins.mixed.math.add("1", 2);',
					"// @ts-expect-error not mounted",
					"self.plugins.other.call();",
					""
				].join("\n"),
				"utf8"
			);
			expect(compile([output, probe], "nodenext")).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("types a member with no module origin as unknown and says why", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "no-origin.d.mts");
		const api = await slothlet({ base: path.join(FIXTURE, "widgets"), mode: "eager", silent: true });
		try {
			await api.slothlet.api.add("services", { exports: { now: () => Date.now() } });
			const { output: content } = await generateFromInstance(api, { output, interfaceName: "NoOriginApi" });
			expect(content).toMatch(/\/\*\* No module origin: [^\n]*\*\/\n\t\tnow: unknown;/);
			expect(content).not.toMatch(/\bany\b/);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("leaves SlothletAPI out when the runtime augmentation is off", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "plain.d.mts");
		await generateTypes({ dir: path.join(FIXTURE, "widgets"), output, interfaceName: "PlainApi", augmentRuntime: false });
		const content = await readFile(output, "utf8");
		expect(content).toContain("export interface PlainApi {");
		expect(content).not.toContain("SlothletAPI");
		expect(content).not.toContain("SlothletSelf");
	});
});
