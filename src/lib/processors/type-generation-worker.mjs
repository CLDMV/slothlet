/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-generation-worker.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:53-07:00 (1791090893)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Worker for strict TypeScript mode's type generation.
 * @module @cldmv/slothlet/processors/type-generation-worker
 * @internal
 *
 * @description
 * Strict mode forks this file (see `typeGenerationWorkerPath()` in `loader.mjs`) to build an eager,
 * fast-mode instance of the api and write its declaration file in a separate process, so the build
 * never shares a module cache with the instance being loaded. The config arrives in the
 * `SLOTHLET_CONFIG` environment variable, and the result goes back to the parent over IPC as
 * `{ type: "success" }` or `{ type: "error", error }`.
 *
 * It ships in `dist/lib/processors/` and imports only `@cldmv/slothlet` self-references, which
 * resolve to `src/` under the `slothlet-dev` condition and to `dist/` in an installed package (#500).
 * Importing the module does nothing; only running it as the process's entry script starts a build.
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";
import { generateTypes } from "@cldmv/slothlet/processors/type-generator";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * IPC sender to the parent process (`process.send` in the fork).
 * @callback WorkerMessageSender
 * @param {{type: string, error: (string|undefined)}} message - `{ type: "success" }` or `{ type: "error", error }`.
 * @returns {void}
 */

/**
 * Receives the worker's exit code (`process.exit` in the fork).
 * @callback WorkerExit
 * @param {number} code - `0` on success, `1` on failure.
 * @returns {void}
 */

/**
 * Build the api described by `configJson` and write its declaration file.
 * @param {string|undefined} configJson - The serialized worker config (`SLOTHLET_CONFIG`): the
 *   slothlet config for an eager, fast-mode instance plus `types` (`{ output, interfaceName, ... }`).
 * @param {WorkerMessageSender|undefined} send - IPC sender to the parent (`process.send` in the
 *   fork); `undefined` when there is no IPC channel.
 * @returns {Promise<number>} The process exit code: `0` on success, `1` on failure.
 * @example
 * const code = await runTypeGeneration(process.env.SLOTHLET_CONFIG, process.send?.bind(process));
 */
export async function runTypeGeneration(configJson, send) {
	let api = null;
	try {
		if (!configJson) {
			throw new SlothletError("TS_TYPE_GENERATION_WORKER_NO_CONFIG", {}, null, { validationError: true });
		}
		const config = JSON.parse(configJson);
		api = await slothlet(config);
		await generateTypes(api, config.types);
		send?.({ type: "success" });
		return 0;
	} catch (error) {
		send?.({ type: "error", error: error.message });
		return 1;
	} finally {
		await api?.slothlet.shutdown();
	}
}

/**
 * Run the type generation and hand its exit code to `exit`, but only when `argv1` is this file —
 * i.e. when the module is the process's entry script (the strict-mode fork). Any other import is a
 * no-op.
 * @param {string|undefined} argv1 - The entry script path (`process.argv[1]`).
 * @param {string|undefined} configJson - The serialized worker config (`SLOTHLET_CONFIG`).
 * @param {WorkerMessageSender|undefined} send - IPC sender to the parent.
 * @param {WorkerExit} exit - Called with the exit code.
 * @returns {Promise<void>|null} The pending run, or `null` when this module is not the entry script.
 * @example
 * runIfEntry(process.argv[1], process.env.SLOTHLET_CONFIG, process.send?.bind(process), process.exit.bind(process));
 */
export function runIfEntry(argv1, configJson, send, exit) {
	if (!argv1 || resolve(argv1) !== fileURLToPath(import.meta.url)) {
		return null;
	}
	return runTypeGeneration(configJson, send).then(exit);
}

runIfEntry(process.argv[1], process.env.SLOTHLET_CONFIG, process.send?.bind(process), process.exit.bind(process));
