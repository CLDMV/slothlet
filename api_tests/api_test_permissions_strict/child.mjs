/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_strict/child.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:25:55-08:00 (1794882355)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Starts an instance of the stack-settings fixture with a permissions mode in a process of its own, so the
 * process's flags (`--disallow-code-generation-from-strings`) are the ones the baseline checks read, and prints what it
 * saw as `RESULT <json>`: `node --conditions=slothlet-dev child.mjs <mode> <runtime>`.
 * @module api_test_permissions_strict.child
 */
import { writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";

const [mode, loading, runtime] = process.argv.slice(2);
SlothletWarning.suppressConsole = true;
const out = {};

/**
 * Record what a step answers, a refusal by its code.
 * @param {string} name - The step.
 * @param {function(): unknown} step - The step.
 * @returns {Promise<void>}
 */
async function record(name, step) {
	try {
		out[name] = await step();
	} catch (error) {
		out[name] = error?.code ?? String(error?.message ?? error);
	}
}

let api = null;
await record("start", async () => {
	api = await slothlet({
		base: fileURLToPath(new URL("../api_test_stack_settings/api", import.meta.url)),
		mode: loading,
		runtime,
		permissions: {
			mode,
			policy: "allow",
			rules: [
				{ caller: "settler.**", target: "vault.**", effect: "deny" },
				{ caller: "**", target: "only.**", effect: "deny" },
				{ caller: "good.**", target: "only.**", effect: "allow" }
			]
		}
	});
	return "started";
});
out.warnings = SlothletWarning.captured.map((warning) => ({ code: warning.code, check: warning.context?.check ?? null }));
if (api) {
	await record("report", () => api.slothlet.permissions.control.report());
	await record("mode", () => api.slothlet.permissions.control.mode);
	await record("good", () => api.good.readOnly());
	await record("settler", () => api.settler.own("none"));
	await record("disable", () => api.slothlet.permissions.control.disable());
	await record("enable", () => api.slothlet.permissions.control.enable());
	await record("modeAfter", () => api.slothlet.permissions.control.mode);
	await record("settlerAfter", () => api.settler.own("none"));
	await api.shutdown();
}
writeSync(1, `RESULT ${JSON.stringify(out)}\n`);
