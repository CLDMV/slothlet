/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-options-sourcemap.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:24-07:00 (1791090924)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `typescript.sourcemap` option (#499).
 *
 * @description
 * `sourcemap: true` must produce transpiled output that carries an INLINE source map whose
 * `sources` names the original `.ts` file by its absolute path — in fast mode (esbuild) and in
 * strict mode's transform path (tsc) — so that `node --enable-source-maps` maps stack frames
 * from the `.slothlet-cache/` copy back to the `.ts` source. With `sourcemap` off, no map is
 * emitted, and the two outputs hash to different cache files so one is never served for the other.
 *
 * @module tests/vitests/suites/typescript/typescript-options-sourcemap.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { transformTypeScript, transformTypeScriptStrict, writeTransformedToCache } from "@cldmv/slothlet/processors/typescript";
import { writeFileSync } from "node:fs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const INLINE_MAP_RE = /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)\s*$/;

/**
 * Decode the inline source map appended to transpiled output.
 * @param {string} code - Transpiled JavaScript.
 * @returns {object|null} The parsed source map, or `null` when none is inlined.
 */
function inlineMap(code) {
	const match = INLINE_MAP_RE.exec(code);
	return match ? JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) : null;
}

const LEAF_SOURCE = [
	"export function boom(label: string): never {",
	"\tconst message: string = `boom-499:${label}`;",
	"\tthrow new Error(message);",
	"}",
	""
].join("\n");

let root;
let leafPath;

beforeAll(async () => {
	root = await makeTestTmpDir("ts-options-sourcemap");
	leafPath = path.join(root, "api", "boom.ts");
	await mkdir(path.dirname(leafPath), { recursive: true });
	await writeFile(leafPath, LEAF_SOURCE, "utf8");
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("fast mode (esbuild) sourcemap", () => {
	it("emits an inline source map naming the absolute .ts path when sourcemap is true", async () => {
		const code = await transformTypeScript(leafPath, { sourcemap: true });
		const map = inlineMap(code);
		expect(map).not.toBeNull();
		expect(map.sources).toEqual([leafPath]);
	});

	it("emits no source map when sourcemap is false or omitted", async () => {
		expect(inlineMap(await transformTypeScript(leafPath, { sourcemap: false }))).toBeNull();
		expect(inlineMap(await transformTypeScript(leafPath))).toBeNull();
	});
});

describe("strict mode (tsc) sourcemap", () => {
	it("emits an inline source map naming the absolute .ts path when sourcemap is true", async () => {
		const { code } = await transformTypeScriptStrict(leafPath, { sourcemap: true, skipTypeCheck: true });
		const map = inlineMap(code);
		expect(map).not.toBeNull();
		expect(map.sources).toEqual([leafPath]);
	});

	it("emits no source map when sourcemap is omitted", async () => {
		const { code } = await transformTypeScriptStrict(leafPath, { skipTypeCheck: true });
		expect(inlineMap(code)).toBeNull();
	});
});

describe("transform cache keys", () => {
	it("writes mapped and unmapped output to different cache files", async () => {
		const instanceID = `ts-options-sourcemap-${process.pid}`;
		const withMap = await transformTypeScript(leafPath, { sourcemap: true });
		const withoutMap = await transformTypeScript(leafPath, { sourcemap: false });
		const a = await writeTransformedToCache(leafPath, withMap, instanceID);
		const b = await writeTransformedToCache(leafPath, withoutMap, instanceID);
		try {
			expect(a.url).not.toBe(b.url);
		} finally {
			await rm(a.cacheDir, { recursive: true, force: true });
		}
	});
});

describe("stack traces under --enable-source-maps", () => {
	/**
	 * Boot slothlet in a child process against the fixture and return the stack of the error
	 * thrown by the `.ts` leaf.
	 * @param {object} typescript - The `typescript` config to boot with.
	 * @returns {string} The child's stdout (the error stack).
	 */
	function stackFromChild(typescript) {
		const script = [
			`import slothlet from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "index.mjs")).href)};`,
			`const api = await slothlet({ dir: ${JSON.stringify(path.dirname(leafPath))}, mode: "eager", silent: true, typescript: ${JSON.stringify(typescript)} });`,
			`try { await api.boom("x"); } catch (error) { process.stdout.write(String(error.stack)); }`,
			`await api.slothlet.shutdown();`
		].join("\n");
		// A script file rather than `-e`: strict mode forks its type-generation worker with the
		// parent's execArgv, and `--input-type` is rejected for a file entry point.
		const scriptPath = path.join(root, `child-${typescript.mode}-${Date.now()}.mjs`);
		writeFileSync(scriptPath, script, "utf8");
		const result = spawnSync(process.execPath, ["--enable-source-maps", scriptPath], {
			cwd: REPO_ROOT,
			env: process.env,
			encoding: "utf8",
			timeout: 90000
		});
		expect(result.status, result.stderr).toBe(0);
		return result.stdout;
	}

	it("points the throwing frame at the .ts source when sourcemap is true (fast mode)", () => {
		const stack = stackFromChild({ mode: "fast", sourcemap: true });
		expect(stack).toContain("boom-499:x");
		expect(stack).toContain(`${leafPath}:3`);
	}, 60000);

	it("points the throwing frame at the .ts source when sourcemap is true (strict mode)", () => {
		const stack = stackFromChild({
			mode: "strict",
			sourcemap: true,
			types: { output: path.join(root, "strict-stack.d.ts"), interfaceName: "StackAPI" }
		});
		expect(stack).toContain("boom-499:x");
		expect(stack).toContain(`${leafPath}:3`);
	}, 90000);

	it("points the throwing frame at the cache copy when sourcemap is off", () => {
		const stack = stackFromChild({ mode: "fast" });
		expect(stack).toContain("boom-499:x");
		expect(stack).not.toContain(leafPath);
	}, 60000);
});
