/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/smoke/run-runtime-floor.mjs
 *	@Date: 2026-11-17T07:57:39-08:00 (1794931059)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:06:19-08:00 (1794931579)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the runtime-floor smoke test on a Node binary you point it at.
 *
 * npm refuses `npm run` below the dev floor (`devEngines`), so this runner is started by npm on the dev Node and
 * launches `tests/smoke/runtime-floor.mjs` on the Node binary named by `SLOTHLET_FLOOR_NODE` (normally a Node 22.15.0
 * build, the `engines.node` floor). It runs the smoke test twice: once as that Node starts by default, and once with
 * `--experimental-async-context-frame` in `NODE_OPTIONS`, so the AsyncContextFrame canary is checked both ways.
 *
 * @example
 * SLOTHLET_FLOOR_NODE=/path/to/node-v22.15.0/bin/node npm run test:runtime-floor
 * SLOTHLET_FLOOR_NODE=/path/to/node-v22.15.0/bin/node npm run test:runtime-floor:dist   # after npm run build
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const floorNode = process.env.SLOTHLET_FLOOR_NODE;
if (!floorNode) {
	console.error(
		"SLOTHLET_FLOOR_NODE is not set. Point it at the Node binary to test (normally Node 22.15.0, the engines.node floor):\n" +
			"  SLOTHLET_FLOOR_NODE=/path/to/node-v22.15.0/bin/node npm run test:runtime-floor"
	);
	process.exit(1);
}

const dist = process.argv.includes("--dist");
const script = fileURLToPath(new URL("./runtime-floor.mjs", import.meta.url));
const args = dist ? [script] : ["--conditions=slothlet-dev", script];

const version = spawnSync(floorNode, ["--version"], { encoding: "utf8" });
if (version.status !== 0) {
	console.error(`SLOTHLET_FLOOR_NODE (${floorNode}) could not be run: ${version.error?.message ?? version.stderr}`);
	process.exit(1);
}
console.log(`Runtime-floor smoke test on Node ${version.stdout.trim()} against ${dist ? "dist" : "src"}`);

const runs = [
	{ label: "default flags", nodeOptions: "" },
	{ label: "--experimental-async-context-frame", nodeOptions: "--experimental-async-context-frame" }
];
let failed = false;
for (const run of runs) {
	console.log(`\n▶ ${run.label}`);
	const env = { ...process.env, NODE_OPTIONS: run.nodeOptions };
	const result = spawnSync(floorNode, args, { stdio: "inherit", env });
	if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
