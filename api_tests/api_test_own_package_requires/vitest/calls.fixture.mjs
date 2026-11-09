/**
 * @fileoverview Run by `helper-require-own-package` in a vitest of its own (#715): runs the own-package require fixture through
 * vitest's module runner with the `slothletInstanceImports()` plugin and prints what every case gave as one JSON line.
 * @module api_test_own_package_requires.vitest.calls
 */

import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCalls } from "../calls.mjs";

it("reports every case", async () => {
	console.log(`OWN-PACKAGE-REQUIRES ${JSON.stringify(await runCalls(slothlet))}`);
});
