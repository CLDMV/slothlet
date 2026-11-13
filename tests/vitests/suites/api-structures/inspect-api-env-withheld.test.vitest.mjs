/**
 * @fileoverview The structure inspection tool never prints the process environment (#759).
 * @description
 * `api.slothlet.env` is the process environment. The tool prints a structure listing and a JSON shape of the whole
 * api, and the structures test puts both shapes in its failure message, so printing `env` would write every
 * environment variable of a CI job to its log. The tool shows that `env` is there, as an object, and nothing in it.
 * @module tests/vitests/suites/api-structures/inspect-api-env-withheld
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const MARKER_NAME = "SLOTHLET_INSPECT_ENV_MARKER";
const MARKER_VALUE = "marker-value-4d1f9a";

/**
 * Run the inspection tool on a fixture with a marker variable in its environment.
 * @param {"--eager"|"--lazy"} modeFlag - Mode flag.
 * @returns {{output: string, shape: object}} Everything the tool wrote, and the api shape it printed.
 */
function runTool(modeFlag) {
	const result = spawnSync("node", [path.join(ROOT, "tools", "dev", "inspect-api-structure.mjs"), "api_test_special_numbers", modeFlag], {
		cwd: ROOT,
		encoding: "utf8",
		env: { ...process.env, [MARKER_NAME]: MARKER_VALUE, NODE_ENV: "development", NODE_OPTIONS: "--conditions=slothlet-dev" }
	});
	const line = result.stdout.split("\n").find((entry) => entry.startsWith("API Shape: "));
	expect(line, result.stderr).toBeDefined();
	return { output: `${result.stdout}\n${result.stderr}`, shape: JSON.parse(line.slice("API Shape: ".length)) };
}

describe.each(["--eager", "--lazy"])("inspect-api-structure withholds slothlet.env (%s)", (modeFlag) => {
	it("prints no environment variable, by name or value", () => {
		const { output } = runTool(modeFlag);
		expect(output).not.toContain(MARKER_VALUE);
		expect(output).not.toContain(MARKER_NAME);
	});

	it("keeps env in the shape as an object with its contents withheld", () => {
		const { shape } = runTool(modeFlag);
		expect(shape.members.slothlet.members.env).toEqual({ type: "object", withheld: true });
		// Other members of api.slothlet are still described in full.
		expect(shape.members.slothlet.members.instanceID.type).toBe("string");
	});
});
